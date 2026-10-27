"""
Monta a sequência "personagem virando a cabeça" a partir de poses-chave.

1. Recebe as poses (centro + viradas para um lado); espelha para gerar o outro lado.
2. Alinha todas pela largura e posição dos ombros (escala + translação).
3. Recorta o fundo chapado (alpha) e normaliza a cor do fundo.
4. Interpola quadros intermediários com optical flow (DIS) entre poses vizinhas.
5. Exporta: sequência WebP com transparência (para o site) e um MP4 com fundo vermelho.

Uso: python3 make_turn.py OUT_DIR C.png R28.png R45.png
     (R28/R45 = cabeça virada para a direita do observador, em graus aproximados)
"""
import os, sys, subprocess
import numpy as np
import cv2
from scipy import ndimage

W, H = 1376, 768
BG = np.array([4, 26, 208], np.float32)  # BGR de #D01A04
STEPS = 20  # quadros por segmento entre poses


def load(path):
    im = cv2.imread(path, cv2.IMREAD_COLOR)
    return cv2.resize(im, (W, H), interpolation=cv2.INTER_AREA).astype(np.float32)


def alpha_of(im, thr=55, soft=28):
    border = np.concatenate([im[0], im[-1], im[:, 0], im[:, -1]])
    bg = np.median(border, axis=0)
    dist = np.sqrt(((im - bg) ** 2).sum(2))
    cand = dist < thr + soft
    lab, _ = ndimage.label(cand)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bgmask = np.isin(lab, list(edge))
    a = np.ones(dist.shape, np.float32)
    a[bgmask] = np.clip((dist[bgmask] - thr) / soft, 0, 1)
    a = ndimage.gaussian_filter(a, 0.7)
    # despill na borda
    k = a[..., None]
    rgb = np.where((k > 0.02) & (k < 0.98), np.clip((im - bg * (1 - k)) / np.maximum(k, 0.15), 0, 255), im)
    return rgb, a


def shoulders(a):
    """Centro x e largura do corpo numa faixa perto da base da imagem."""
    band = a[int(H * 0.93):int(H * 0.97)] > 0.5
    cols = np.where(band.any(0))[0]
    return (cols.min() + cols.max()) / 2, cols.max() - cols.min()


def align(rgb, a, ref_cx, ref_w):
    cx, w = shoulders(a)
    s = ref_w / w
    # escala ancorada na base (y = H) e no centro dos ombros
    M = np.float32([[s, 0, ref_cx - s * cx], [0, s, H - s * H]])
    rgb2 = cv2.warpAffine(rgb, M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    a2 = cv2.warpAffine(a, M, (W, H), flags=cv2.INTER_LINEAR, borderValue=0)
    return rgb2, a2


def comp(rgb, a):
    return rgb * a[..., None] + BG * (1 - a[..., None])


def flow(a_img, b_img):
    ga = cv2.cvtColor(a_img.astype(np.uint8), cv2.COLOR_BGR2GRAY)
    gb = cv2.cvtColor(b_img.astype(np.uint8), cv2.COLOR_BGR2GRAY)
    dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    dis.setFinestScale(0)
    dis.setPatchSize(16)
    dis.setPatchStride(4)
    dis.setGradientDescentIterations(40)
    dis.setVariationalRefinementIterations(10)
    dis.setVariationalRefinementAlpha(30)
    f = dis.calc(ga, gb, None)
    # suaviza o campo para evitar rasgos
    return cv2.GaussianBlur(f, (0, 0), 3)


def warp(img, fl, t):
    gx, gy = np.meshgrid(np.arange(W, dtype=np.float32), np.arange(H, dtype=np.float32))
    mx = gx - t * fl[..., 0]
    my = gy - t * fl[..., 1]
    return cv2.remap(img, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)


def main():
    out, c_path, r1_path, r2_path = sys.argv[1:5]
    os.makedirs(out, exist_ok=True)
    poses = {}
    C_rgb, C_a = alpha_of(load(c_path))
    ref_cx, ref_w = shoulders(C_a)
    poses['C'] = (C_rgb, C_a)
    for name, p in [('R1', r1_path), ('R2', r2_path)]:
        rgb, a = alpha_of(load(p))
        poses[name] = align(rgb, a, ref_cx, ref_w)
    # lado esquerdo = espelho do direito (espelha em torno do centro dos ombros)
    def mirror(rgb, a):
        M = np.float32([[-1, 0, 2 * ref_cx], [0, 1, 0]])
        return (cv2.warpAffine(rgb, M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE),
                cv2.warpAffine(a, M, (W, H), flags=cv2.INTER_LINEAR, borderValue=0))
    def interp(pa, pb, steps):
        (ra, aa), (rb, ab) = pa, pb
        ca, cb = comp(ra, aa), comp(rb, ab)
        fab = flow(ca, cb)
        fba = flow(cb, ca)
        rgba_a = np.dstack([ra, aa * 255])
        rgba_b = np.dstack([rb, ab * 255])
        out_frames = []
        for k in range(steps):
            t = k / steps
            te = t * t * (3 - 2 * t)  # suaviza a velocidade dentro do segmento
            fa = warp(rgba_a, fab, te)
            fb = warp(rgba_b, fba, 1 - te)
            # onde as duas previsões discordam, confia mais na pose mais próxima
            diff = np.abs(fa[..., :3] - fb[..., :3]).mean(2, keepdims=True) / 255
            conf = np.clip(diff * 4, 0, 1)
            wb = te * (1 - conf) + (1.0 if te >= 0.5 else 0.0) * conf
            wb = cv2.GaussianBlur(wb.astype(np.float32), (0, 0), 2)[..., None]
            out_frames.append((1 - wb) * fa + wb * fb)
        return out_frames

    def mirror_rgba(f):
        M = np.float32([[-1, 0, 2 * ref_cx], [0, 1, 0]])
        return cv2.warpAffine(f, M, (W, H), flags=cv2.INTER_LINEAR, borderValue=0)

    # Lado direito (centro -> direita), com poses reais
    right = interp(poses['C'], poses['R1'], STEPS) + interp(poses['R1'], poses['R2'], STEPS)
    rl, al = poses['R2']
    right.append(np.dstack([rl, al * 255]))
    # Lado esquerdo = espelho da sequência direita (evita misturar franja original com espelhada)
    left = [mirror_rgba(f) for f in reversed(right)]  # termina no espelho do centro
    # Centro: transição curta e de pouco movimento entre o espelho do centro e o centro original
    # (só a mecha da franja muda de lado; um cruzamento simples não rasga como o optical flow)
    mc = np.dstack([mirror(*poses['C'])[0], mirror(*poses['C'])[1] * 255])
    cc = np.dstack([poses['C'][0], poses['C'][1] * 255])
    center = [(1 - k / 3) * mc + (k / 3) * cc for k in range(1, 3)]
    frames = left + center + right

    # recorte comum (bbox da união do alpha) para o site
    union = np.zeros((H, W), bool)
    for f in frames:
        union |= f[..., 3] > 8
    ys, xs = np.where(union)
    pad = 12
    x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad, W)
    y0, y1 = max(ys.min() - pad, 0), H
    tw = 480
    th = round((y1 - y0) * tw / (x1 - x0))
    seq_dir = os.path.join(out, 'seq')
    os.makedirs(seq_dir, exist_ok=True)
    tmp_dir = os.path.join(out, 'mp4frames')
    os.makedirs(tmp_dir, exist_ok=True)
    for i, f in enumerate(frames):
        f = np.clip(f, 0, 255).astype(np.uint8)
        crop = cv2.resize(f[y0:y1, x0:x1], (tw, th), interpolation=cv2.INTER_AREA)
        rgba = cv2.cvtColor(crop, cv2.COLOR_BGRA2RGBA)
        from PIL import Image
        Image.fromarray(rgba, 'RGBA').save(os.path.join(seq_dir, f'{i:03d}.webp'), 'WEBP', quality=74, method=5)
        full = comp(f[..., :3].astype(np.float32), f[..., 3].astype(np.float32) / 255).astype(np.uint8)
        cv2.imwrite(os.path.join(tmp_dir, f'{i:03d}.png'), cv2.resize(full, (1280, 714)))
    n = len(frames)
    print('frames', n, 'crop', (x0, y0, x1, y1), 'size', (tw, th))
    # MP4: ida (esquerda->direita) e volta, keyframe em todo quadro para scrub liso
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', '24', '-i', os.path.join(tmp_dir, '%03d.png'),
                    '-vf', 'pad=1280:720:0:3:color=0xD01A04', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
                    '-g', '1', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', os.path.join(out, 'hero-turn.mp4')], check=True)
    with open(os.path.join(out, 'meta.txt'), 'w') as fh:
        fh.write(f'{n} {tw} {th}\n')


if __name__ == '__main__':
    main()
