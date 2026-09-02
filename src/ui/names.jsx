/**
 * 対局中のプレイヤー名。
 *
 * 盤も記録も色(赤/青)で書かれているが、それだけだと
 * 「どちらが自分か」を毎回読み替えることになる。
 * 名前が分かっている対局では、色のかわりに名前を出す。
 *
 * 名前は席ごとに [先手, 後手] で持つ。
 * 1台で交互に指すときは誰の名前も無いので、色名のまま。
 */
import { createContext, useContext } from "react";

const NamesContext = createContext(null);

export const NamesProvider = NamesContext.Provider;

/** [先手の名前, 後手の名前]。無ければ null */
export function useNames() {
  return useContext(NamesContext);
}
