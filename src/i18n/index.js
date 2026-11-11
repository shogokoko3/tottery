/**
 * 英語版(2026-11-11 本人の指示「画面の文を英語にする。ストーリーと漫画は日本語のまま」)。
 *
 * 日本語の文そのものを辞書のキーにする。日本語の端末ではキーをそのまま返すので、
 * 日本語の表示は一字も変わらない。英語の端末では en/ の辞書を引く。
 * 決めごとと一覧は reports/i18n-20261111/ にある。
 *
 *   L("挑戦する")                         画面に出す文
 *   L("フレンドは{n}人までです。", { n })   差し込みは {名前}
 *   Lk("覇者") / Lk("…{n}…", { n })      保存・送信・比べるのに日本語のまま使う文。値は日本語のまま。
 *                                          出すところで Lx() を通す(検査が英訳の有無を見る)
 *   Lx(text)                              Lk の文・サーバーから届いた日本語を、出すところで訳す。
 *                                          {n} の入った辞書の文にも当てる
 *
 * 言語は起動のときに一度だけ決める: 端末の言語の1番目が日本語なら ja、それ以外は en。
 * ブラウザでは ?lang=en / ?lang=ja で切り替えられる(確かめ用。その後もその窓では続く)。
 * Node(検査)と Worker(サーバー)には画面が無いので ja。検査で英語を見るときは
 * 環境変数 TOTTERY_LANG=en。
 */
import { EN } from "./en/index.js";

function detect() {
  const env = globalThis.process?.env?.TOTTERY_LANG;
  if (env === "en" || env === "ja") return env;
  if (typeof document === "undefined") return "ja";
  // Node の検査は document を作り物で置くことがある。navigator は Node の言語(en-US)なので見ない
  if (globalThis.process?.versions?.node) return "ja";
  try {
    const q = new URLSearchParams(globalThis.location?.search || "").get("lang");
    if (q === "en" || q === "ja") {
      globalThis.sessionStorage?.setItem("tottery:lang", q);
      return q;
    }
    const kept = globalThis.sessionStorage?.getItem("tottery:lang");
    if (kept === "en" || kept === "ja") return kept;
  } catch {
    /* 保存が使えない窓でも端末の言語で決める */
  }
  const nav = globalThis.navigator;
  const first = (nav?.languages && nav.languages[0]) || nav?.language || "ja";
  return /^ja\b/i.test(first) ? "ja" : "en";
}

/** "ja" か "en" */
export const LANG = detect();
export const isEnglish = LANG === "en";
/** Intl に渡す言語 */
export const LOCALE = isEnglish ? "en-US" : "ja-JP";

function fill(s, vars) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k) =>
    Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m,
  );
}

/** 画面に出す文。英訳が無ければ日本語のまま(検査が落ちる) */
export function L(ja, vars) {
  return fill(isEnglish ? (EN[ja] ?? ja) : ja, vars);
}

/**
 * 保存・送信・比べるために日本語のまま持つ文の目印。いつも日本語を返す(差し込みは埋める)。
 * 英語は出すところで Lx() が辞書から引く
 */
export const Lk = (ja, vars) => fill(ja, vars);

/** {n} を含む辞書の文を、当てはめ用の形にしたもの(英語のときだけ作る) */
let patterns = null;
function patternList() {
  if (patterns) return patterns;
  patterns = [];
  for (const key of Object.keys(EN)) {
    if (!/\{\w+\}/.test(key)) continue;
    const names = [];
    const src = key
      .split(/(\{\w+\})/)
      .map((part) => {
        const m = /^\{(\w+)\}$/.exec(part);
        if (!m) return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        names.push(m[1]);
        return "([\\s\\S]*?)";
      })
      .join("");
    const literal = key.replace(/\{\w+\}/g, "").length;
    patterns.push({ re: new RegExp(`^${src}$`), names, en: EN[key], literal });
  }
  // 決まった字の多い形から当てる(「{how}。」のような短い形が、長い文を先に取らないように)
  patterns.sort((a, b) => b.literal - a.literal);
  return patterns;
}

/**
 * 出来上がった日本語(Lk の文・サーバーの返事)を訳す。辞書にそのまま無ければ {n} の形で当てる。
 * 差し込まれた部分も訳せるものは訳す(「シーズン1 王の証」のような組み立て)
 */
export function Lx(text) {
  if (!isEnglish || typeof text !== "string" || !text) return text;
  if (Object.prototype.hasOwnProperty.call(EN, text)) return EN[text];
  for (const p of patternList()) {
    const m = p.re.exec(text);
    if (!m) continue;
    const vars = {};
    p.names.forEach((n, i) => (vars[n] = Lx(m[i + 1])));
    return fill(p.en, vars);
  }
  return text;
}

/** 数(3桁区切り) */
export const fmtNumber = (n) => Number(n || 0).toLocaleString(LOCALE);

/** 日付・時刻。opts は Intl.DateTimeFormat と同じ */
export const fmtDate = (d, opts) =>
  new Intl.DateTimeFormat(LOCALE, opts).format(d instanceof Date ? d : new Date(d));
