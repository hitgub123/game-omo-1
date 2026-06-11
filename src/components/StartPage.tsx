import React from 'react';
import '../styles/title-screen.css';

interface StartPageProps {
  onStartSolo: () => void;
  onStartTeam: () => void;
}

// Auto-discover background images from assets/pic/desktop/
// Just drop new .jpg/.png/.webp files there — Vite picks them up automatically.
const bgModules = import.meta.glob<string>(
  '/assets/pic/desktop/*.{jpg,png,webp}',
  { eager: true, query: '?url', import: 'default' },
);
const BG_IMAGES = Object.values(bgModules);
const FALLBACK_BG = '/bg/Konachan.com - 404789 sample.jpg';

const SLIDE_INTERVAL_MS = 8000;

const StartPage: React.FC<StartPageProps> = ({ onStartSolo, onStartTeam }) => {
  const [slideIdx, setSlideIdx] = React.useState(0);
  const [prevIdx, setPrevIdx] = React.useState<number | null>(null);

  const total = BG_IMAGES.length;

  // cycle background on interval
  React.useEffect(() => {
    if (total <= 1) return;
    const timer = setInterval(() => {
      setPrevIdx(slideIdx);
      setSlideIdx(i => (i + 1) % total);
    }, SLIDE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [slideIdx, total]);

  // preload next image for smooth transition
  React.useEffect(() => {
    if (total <= 1) return;
    const nextIdx = (slideIdx + 1) % total;
    const img = new Image();
    img.src = BG_IMAGES[nextIdx] || FALLBACK_BG;
  }, [slideIdx, total]);

  // manual jump to a specific slide
  const goToSlide = React.useCallback((idx: number) => {
    if (idx === slideIdx) return;
    setPrevIdx(slideIdx);
    setSlideIdx(idx);
  }, [slideIdx]);

  const currentBg = BG_IMAGES[slideIdx] || FALLBACK_BG;
  const prevBg = prevIdx !== null ? (BG_IMAGES[prevIdx] || FALLBACK_BG) : null;

  return (
    <div className="start-page">
      {/* Previous background (fading out) */}
      {prevBg !== null && prevIdx !== slideIdx && (
        <div
          className="start-bg start-bg-prev"
          style={{ backgroundImage: `url(${prevBg})` }}
        />
      )}
      {/* Current background */}
      <div
        className="start-bg"
        style={{ backgroundImage: `url(${currentBg})` }}
      />
      <div className="start-overlay" />

      <div className="start-title">
        <h1>东方幻想麻雀</h1>
        <p>TOUHOU GENSOU MAHJONG</p>
      </div>

      <div className="start-menu">
        <button className="start-btn" onClick={onStartSolo}>
          单人模式
          <span className="sub">SINGLE PLAYER</span>
        </button>
        <button className="start-btn" onClick={onStartTeam}>
          组队模式
          <span className="sub">TEAM BATTLE</span>
        </button>
        <button className="start-btn" disabled>
          剧情模式
          <span className="sub">STORY MODE — COMING SOON</span>
        </button>
        <button className="start-btn" disabled>
          联机模式
          <span className="sub">ONLINE MULTIPLAYER — COMING SOON</span>
        </button>
      </div>

      {/* Slide indicator dots — click to jump (max 10 visible) */}
      <div className="start-slide-dots">
        {(() => {
          const MAX_DOTS = 10;
          const total = BG_IMAGES.length;
          const dots: (number | null)[] = [];

          if (total <= MAX_DOTS) {
            // Show all
            for (let i = 0; i < total; i++) dots.push(i);
          } else {
            // Always show first
            dots.push(0);
            // Window around current
            const half = Math.floor((MAX_DOTS - 3) / 2);
            let start = Math.max(1, slideIdx - half);
            let end = Math.min(total - 2, slideIdx + half);
            if (end - start < MAX_DOTS - 3) {
              if (start === 1) end = Math.min(total - 2, start + MAX_DOTS - 4);
              else start = Math.max(1, end - MAX_DOTS + 4);
            }
            if (start > 1) dots.push(null); // "..."
            for (let i = start; i <= end; i++) dots.push(i);
            if (end < total - 2) dots.push(null); // "..."
            // Always show last
            dots.push(total - 1);
          }

          return dots.map((item, idx) =>
            item === null ? (
              <span key={`ellipsis-${idx}`} className="slide-ellipsis">···</span>
            ) : (
              <span
                key={item}
                className={`slide-dot ${item === slideIdx ? 'active' : ''}`}
                onClick={() => goToSlide(item)}
              />
            ),
          );
        })()}
      </div>
    </div>
  );
};

export default StartPage;
