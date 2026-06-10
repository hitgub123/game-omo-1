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

const StartPage: React.FC<StartPageProps> = ({ onStartSolo, onStartTeam }) => {
  const bgImage = React.useMemo(
    () => BG_IMAGES[Math.floor(Math.random() * BG_IMAGES.length)],
    []
  );

  return (
    <div className="start-page">
      <div className="start-bg" style={{ backgroundImage: `url(${bgImage})` }} />
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
    </div>
  );
};

export default StartPage;
