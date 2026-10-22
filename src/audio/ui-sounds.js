import { playSound } from './player.js';

let installed = false;
/** Local application controls only: never OS notification/system sounds. */
export function installUiSounds() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  document.addEventListener('click', event => {
    if (event.defaultPrevented || document.hidden) return;
    const control = event.target?.closest?.('button, [role="button"]');
    if (!control || !control.closest('.tottery-root') || control.disabled || control.getAttribute('aria-disabled') === 'true') return;
    if (control.closest('[data-sound="off"]')) return;
    const label = control.getAttribute('aria-label') || control.textContent?.trim() || '';
    const cue = /^(戻る|閉じる|キャンセル|ホームへ)$/.test(label) ? 'back'
      : /^(決定|確定|布陣を確定|王を選ぶ)$/.test(label) ? 'confirm' : 'tap';
    playSound(control.dataset.sound || cue);
  });
}
