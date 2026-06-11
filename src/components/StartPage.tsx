import React from 'react';
import '../styles/title-screen.css';

interface StartPageProps {
  onStartSolo: () => void;
  onStartTeam: () => void;
}

const BG_IMAGES = [
  '/bg/Konachan.com - 398756 sample.jpg',
  '/bg/Konachan.com - 403419 sample.jpg',
  '/bg/Konachan.com - 403798 sample.jpg',
  '/bg/Konachan.com - 404789 sample.jpg',
];

const SLIDE_INTERVAL_MS = 8000;

const StartPage: React.FC<StartPageProps> = ({ onStartSolo, onStartTeam }) => {
  const [slideIdx, setSlideIdx] = React.useState(0);
  const [prevIdx, setPrevIdx] = React.useState<number | null>(null);

  // cycle background on interval
  React.useEffect(() => {
    const timer = setInterval(() => {
      setPrevIdx(slideIdx);
      setSlideIdx(i => (i + 1) % BG_IMAGES.length);
    }, SLIDE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [slideIdx]);

  // preload next image for smooth transition
  React.useEffect(() => {
    const nextIdx = (slideIdx + 1) % BG_IMAGES.length;
    const img = new Image();
    img.src = encodeURI(BG_IMAGES[nextIdx]);
  }, [slideIdx]);

  return (
    <div className="start-page">
      {/* Previous background (fading out) — only render during transition */}
      {prevIdx !== null && prevIdx !== slideIdx && (
        <div
          className="start-bg start-bg-prev"
          style={{ backgroundImage: `url(${encodeURI(BG_IMAGES[prevIdx])})` }}
        />
      )}
      {/* Current background */}
      <div
        className="start-bg"
        style={{ backgroundImage: `url(${encodeURI(BG_IMAGES[slideIdx])})` }}
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

      {/* Slide indicator dots */}
      <div className="start-slide-dots">
        {BG_IMAGES.map((_, i) => (
          <span key={i} className={`slide-dot ${i === slideIdx ? 'active' : ''}`} />
        ))}
      </div>
    </div>
  );
};

export default StartPage;
