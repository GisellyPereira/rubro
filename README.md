# Rubro Studio

Landing page de um estúdio fictício de personagens 3D, com animações interativas.

**Site no ar:** https://rubro-studio.netlify.app

## O que tem

- **Hero com personagem que segue o cursor:** inclinação 3D e parallax. No celular, segue o toque ou o giroscópio. Quando ninguém mexe, ela "respira" de um lado pro outro.
- **Suporte a vídeo controlado pelo cursor:** coloque `public/video/hero.mp4` (personagem virando a cabeça da esquerda para a direita, fundo `#D01A04`) e o site passa a fazer o *scrub* do vídeo pela posição X do mouse automaticamente. Exporte com keyframe em todo frame para ficar liso:
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
