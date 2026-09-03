/**
 * 対局中の席の情報(名前とアイコン)。
 *
 * 盤も記録も色(赤/青)で書かれているが、それだけだと
 * 「どちらが自分か」を毎回読み替えることになる。
 * 名前が分かっている対局では、色のかわりに名前を出す。
 *
 * どちらも席ごとに [先手, 後手] で持つ。
 * 1台で交互に指すときは誰の名前も無いので、色名のまま。
 */
import { createContext, useContext } from "react";

const SeatsContext = createContext({ names: null, icons: null, titles: null });

export const SeatsProvider = SeatsContext.Provider;

export function useSeats() {
  return useContext(SeatsContext);
}

/** [先手の名前, 後手の名前]。無ければ null */
export function useNames() {
  return useSeats().names;
}

/** [先手のアイコン, 後手のアイコン]。無ければ null */
export function useSeatIcons() {
  return useSeats().icons;
}

/** [先手の称号id, 後手の称号id]。無ければ null */
export function useSeatTitles() {
  return useSeats().titles;
}
