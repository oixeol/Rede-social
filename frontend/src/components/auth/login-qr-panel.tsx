import { headers } from 'next/headers';

import { VibraLogo } from '@/components/shell/vibra-logo';
import { createQrCode } from '@/lib/qr-code';
import { resolvePublicOrigin } from '@/lib/public-origin';

/**
 * Bloco de login por QR code (coluna direita da página de entrada).
 *
 * O QR aponta para a origem pública canônica de `/entrar`. Em produção essa
 * origem vem de `VIBRA_PUBLIC_ORIGIN`; cabeçalhos `Host` não são usados para
 * evitar que uma requisição maliciosa gere QR para domínio externo.
 *
 * Componente de servidor: sem handlers de evento.
 */
export async function LoginQrPanel() {
  const headerList = await headers();
  const publicOrigin = resolvePublicOrigin(headerList);

  if (!publicOrigin) {
    return (
      <div className="flex w-full flex-col items-center text-center" role="status">
        <div className="grid size-[148px] place-items-center rounded-[20px] border border-[#2E2E2E] bg-[#111111] p-4 text-center text-[12px] leading-5 text-[#A1A1AA]">
          QR indisponível até VIBRA_PUBLIC_ORIGIN ser configurado.
        </div>
        <h2 className="mt-6 font-display text-[19px] font-semibold tracking-[-0.01em] text-white">
          Entrar com código QR
        </h2>
        <p className="mt-2 max-w-[210px] text-[12.5px] leading-[1.65] text-[#A1A1AA]">
          O acesso por código QR será liberado após a configuração do endereço público.
        </p>
      </div>
    );
  }

  const target = `${publicOrigin}/entrar`;
  const qrCode = createQrCode(target);
  const quietZone = 4;
  const viewBoxSize = qrCode.size + quietZone * 2;

  return (
    <div className="flex w-full flex-col items-center text-center">
      <div className="relative grid size-[148px] place-items-center rounded-[20px] bg-white p-2 shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
        <svg
          aria-hidden="true"
          className="size-full"
          viewBox={`${-quietZone} ${-quietZone} ${viewBoxSize} ${viewBoxSize}`}
          shapeRendering="crispEdges"
        >
          <rect
            x={-quietZone}
            y={-quietZone}
            width={viewBoxSize}
            height={viewBoxSize}
            fill="#FFFFFF"
          />
          <path d={qrCode.path} fill="#000000" />
        </svg>
        <span className="absolute left-1/2 top-1/2 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[10px] bg-[#FF6A00]">
          <VibraLogo compact />
        </span>
      </div>

      <h2 className="mt-6 font-display text-[19px] font-semibold tracking-[-0.01em] text-white">
        Entrar com código QR
      </h2>
      <p className="mt-2 max-w-[210px] text-[12.5px] leading-[1.65] text-[#A1A1AA]">
        Escaneie o código com o app Vibra no celular para entrar imediatamente.
      </p>
    </div>
  );
}
