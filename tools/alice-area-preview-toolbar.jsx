import { alicePreviewAreas, referencePreviewAreas } from './alice-area-game-fixture.mjs';
export function AliceAreaPreviewToolbar() {
  const active = new URLSearchParams(location.search).get('area') || 'alice-tea';
  const params = new URLSearchParams(location.search);
  const setParam = (key,value) => { const next = new URLSearchParams(location.search); next.set(key,value); location.search = next.toString(); };
  return <div className="preview-toolbar">
    <label>エリア <select aria-label="エリア" value={active} onChange={e=>setParam('area',e.target.value)}>
      <optgroup label="シーズン2">{alicePreviewAreas.map(([id,name])=><option value={id} key={id}>{name}</option>)}</optgroup>
      <optgroup label="既存エリアとの比較">{referencePreviewAreas.map(([id,name])=><option value={id} key={id}>{name}</option>)}</optgroup>
    </select></label>
    {active==='alice-tea' && <label>背景 <select aria-label="お茶会の背景" value={params.get('teaDesign') || 'after'} onChange={e=>setParam('teaDesign',e.target.value)}><option value="after">採用版（正方形テーブル）</option><option value="oval">修正前（楕円のテーブル）</option><option value="edge">周辺で開く案</option><option value="before">初期案</option></select></label>}
    <label><input type="checkbox" aria-label="四隅に駒を置く" checked={params.get('corners')==='1'} onChange={e=>setParam('corners',e.target.checked?'1':'0')}/>四隅に駒を置く</label>
    <button onClick={()=>location.reload()}>対局をリセット</button>
    <span>駒をタップして遊べます</span>
  </div>;
}
