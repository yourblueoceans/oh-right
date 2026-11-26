import { useEffect, useState } from 'react';
import { getSticker } from '../../data/repo';
import { parseSource } from '../../domain/ids';
import type { Sticker } from '../../domain/types';
import type { AppCtx } from '../App';
import { ConfirmDose } from '../components/ConfirmDose';
import { Header } from '../components/Common';
import { Loading, MembersOnly } from './Misc';
import { navigate } from '../router';
import { Home } from './Home';

/** /t/<sticker_id>?via=nfc|qr → Confirm screen with the medicine and plan dose pre-filled. */
export function StickerScreen({ ctx, stickerId, search }: { ctx: AppCtx; stickerId: string; search: string }) {
  const fromList = ctx.snap.stickers.find((s) => s.id === stickerId) ?? null;
  const [sticker, setSticker] = useState<Sticker | null | undefined>(fromList ?? undefined);

  useEffect(() => {
    if (fromList) return setSticker(fromList);
    let live = true;
    getSticker(stickerId).then(
      (s) => live && setSticker(s),
      () => live && setSticker(null),
    );
    return () => {
      live = false;
    };
  }, [stickerId, fromList]);

  if (sticker === undefined) return <Loading />;
  const med = sticker && sticker.group_id === ctx.snap.group!.id ? ctx.snap.medications.find((m) => m.id === sticker.medication_id) : null;
  if (!sticker || sticker.group_id !== ctx.snap.group!.id) return <MembersOnly />;
  if (!med) {
    return (
      <main className="page">
        <Header title="Sticker" back="/home" />
        <p className="lead">This sticker's medicine was removed.</p>
      </main>
    );
  }

  const done = () => navigate('/home', { replace: true });
  return (
    <>
      <Home ctx={ctx} />
      <ConfirmDose ctx={ctx} medication={med} source={parseSource(search)} stickerId={sticker.id} onDone={done} />
    </>
  );
}
