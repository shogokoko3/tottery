/**
 * 検査用の @capacitor/core の偽物(iOS ネイティブのふり)。
 * registerPlugin は本物と同じく Proxy を返し、**どんな名前でも**メソッドを返す(then も)。
 * これが本物の振る舞いで、async 関数からそのまま返すと永遠に戻らない(2026-09-15 に踏んだ)。
 * メソッドの応答は globalThis.__pluginCalls に控え、globalThis.__pluginImpl で決める。
 */
export const Capacitor = {
  isNativePlatform: () => true,
  getPlatform: () => "ios",
};
export function registerPlugin(name) {
  return new Proxy(
    {},
    {
      get: (_, prop) => {
        if (prop === "$$typeof") return undefined;
        if (prop === "toJSON") return () => ({});
        return (...args) => {
          (globalThis.__pluginCalls ||= []).push(`${name}.${String(prop)}`);
          const impl = globalThis.__pluginImpl && globalThis.__pluginImpl[String(prop)];
          // 本物: 実装の無い名前は「未実装」で reject した promise を返すだけで、
          // then(resolve, reject) の引数は呼ばない → await すると永遠に待つ
          if (!impl) return Promise.reject(new Error(`"${name}.${String(prop)}()" is not implemented on ios`));
          return impl(...args);
        };
      },
    },
  );
}
export class WebPlugin {}
