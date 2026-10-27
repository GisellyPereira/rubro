# Rubro Studio

Landing page de um estúdio fictício de personagens 3D, com animações interativas.

**Site no ar:** https://rubro-studio.netlify.app

## O que tem

- **Hero com personagem que vira a cabeça seguindo o cursor:** como no efeito "cursor tracking" do Framer. A posição X do mouse escolhe o quadro de uma sequência de 84 imagens (`public/img/turn/`) em que ela vira a cabeça e os olhos de um lado pro outro. No celular, segue o toque ou o giroscópio. Parada, ela olha de um lado pro outro sozinha.
  - Como a sequência foi feita (`scripts/make_turn.py`): poses-chave geradas com IA (Nano Banana Pro) a partir da imagem original, espelhadas para o outro lado, alinhadas pelos ombros, com fundo removido e quadros intermediários criados por *optical flow*. O mesmo script gera `public/video/hero-turn.mp4` (vídeo da animação com fundo vermelho).
  - Para trocar por um vídeo gerado por IA (ex.: Veo/Kling), coloque o MP4 em `public/video/hero.mp4` e adicione `data-src="/video/hero.mp4"` no `<video>` do hero. Exporte com keyframe em todo frame:
    ```bash
    ffmpeg -i entrada.mp4 -an -c:v libx264 -g 1 -crf 22 -preset veryfast -movflags +faststart public/video/hero.mp4
    ```
- Campo de pontos em canvas que reage ao cursor, brilho que acompanha o mouse e texto vazado em parallax
- Preloader com contador e cortina
- Cursor customizado com rótulo "Ver projeto" nos trabalhos
- Botões magnéticos e links com efeito de rolagem
- Faixa (marquee) com velocidade e direção ligadas ao scroll
- Títulos revelados por linha, texto que "acende" palavra por palavra
- Cards de serviço com inclinação 3D e brilho
- Parallax nas imagens dos trabalhos
- Linha do processo desenhada pelo scroll e contadores animados
- Olhinhos do CTA que seguem o cursor e piscam
- Scroll suave (Lenis) e respeito a `prefers-reduced-motion`

## Stack

Vite, GSAP (ScrollTrigger) e Lenis. Imagens dos personagens geradas com IA e o fundo do personagem principal removido por `scripts/cutout.py`.

## Rodar localmente

```bash
npm install
npm run dev
```

Build de produção: `npm run build` (gera `dist/`). O deploy na Netlify usa o `netlify.toml`.
