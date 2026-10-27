# Remove o fundo chapado das imagens geradas (chroma key por cor + flood fill a partir das bordas)
import sys, numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

def cutout(src, dst, thr=55, soft=28, maxw=None):
    im = Image.open(src).convert('RGB')
    if maxw and im.width > maxw:
        im = im.resize((maxw, round(im.height * maxw / im.width)), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32)
    h, w, _ = a.shape
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    bg = np.median(border, axis=0)
    dist = np.sqrt(((a - bg) ** 2).sum(2))
    cand = dist < thr + soft
    lab, _ = ndimage.label(cand)
    edge_labels = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bgmask = np.isin(lab, list(edge_labels))
    alpha = np.ones((h, w), np.float32)
    ramp = np.clip((dist - thr) / soft, 0, 1)
    alpha[bgmask] = ramp[bgmask]
    alpha = ndimage.gaussian_filter(alpha, 0.7)
    # despill: puxa a cor da borda para longe do fundo
    edge = (alpha > 0.02) & (alpha < 0.98)
    rgb = a.copy()
    k = alpha[..., None]
    rgb[edge] = np.clip((a[edge] - bg * (1 - k[edge])) / np.maximum(k[edge], 0.15), 0, 255)
    out = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    o = Image.fromarray(out, 'RGBA')
    bbox = o.getbbox()
    o = o.crop(bbox)
    o.save(dst, 'WEBP', quality=85, method=6)
    print(dst, o.size, 'bg', bg.astype(int), 'bbox', bbox, (w, h))

if __name__ == '__main__':
    cutout(sys.argv[1], sys.argv[2], maxw=int(sys.argv[3]) if len(sys.argv) > 3 else None)
