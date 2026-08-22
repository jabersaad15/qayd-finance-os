import QRCode from "qrcode";
import { useEffect, useState } from "react";
import React from "react";

export function ZatcaQrCode({ payload, onReady }: { payload: string; onReady?: (ready: boolean) => void }) {
  const [imageUrl, setImageUrl] = useState<string>();

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(payload, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 156,
      color: { dark: "#142d4d", light: "#ffffff" },
    }).then((url) => {
      if (active) {
        setImageUrl(url);
        onReady?.(true);
      }
    }).catch(() => {
      if (active) {
        setImageUrl(undefined);
        onReady?.(false);
      }
    });
    return () => { active = false; };
  }, [onReady, payload]);

  return (
    <section className="rounded-md border border-[#bfcde0] bg-white/95 p-2 text-center" data-testid="zatca-qr-code">
      {imageUrl ? <img src={imageUrl} alt="رمز QR الضريبي لفاتورة ZATCA" className="mx-auto h-[31mm] w-[31mm]" /> : <div className="h-[31mm] w-[31mm]" aria-label="جارٍ تجهيز رمز QR الضريبي" />}
      <p className="mt-1 text-[9px] font-medium text-[#53616e]">ZATCA Tax QR</p>
    </section>
  );
}
