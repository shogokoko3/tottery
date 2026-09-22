import { createRoot } from "react-dom/client";
import { CardFace, CardBack, Piece } from "../../src/ui/cards.jsx";
import STYLES from "../../src/styles.css";

const ranks = ["A", "2", "10", "J", "Q", "K"];

function Row({ label, isKing, size = "lg" }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ color: "#f0d98a", fontSize: 13, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {ranks.map((r) => (
          <CardFace key={r} rank={r} suit="spade" size={size} isKing={isKing} />
        ))}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <div className="tottery-root" style={{ padding: 16 }}>
    <style>{STYLES}</style>
    <Row label="通常版 (isKing=false)" isKing={false} />
    <Row label="隊長版 (isKing=true) — 金色に光る" isKing={true} />
    <Row label="5×5の駒" isKing={true} size="md" />
    <Row label="9×9の駒" isKing={true} size="xs" />
    <div style={{ color: "#f0d98a", fontSize: 13, marginBottom: 6 }}>裏面</div>
    <CardBack colorHex="#c1543a" size="lg" />
  </div>,
);
