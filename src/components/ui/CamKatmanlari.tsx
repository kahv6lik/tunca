/**
 * Cam yüzey katmanları — v1.24.0.
 *
 * Bir yüzeyi "liquid glass" yapan beş katmanı çizer. Kullanımı:
 *
 * ```tsx
 * <div className="cam rounded-2xl">
 *   <CamKatmanlari />
 *   …içerik…
 * </div>
 * ```
 *
 * Katmanlar `position: absolute`, `pointer-events: none` ve `z-index: -1`
 * taşır: içeriğin ALTINDA dururlar, hiçbir tıklamayı ya da odaklanmayı
 * engellemezler. Bu yüzden bir yüzeyi cama çevirmek, o yüzeydeki hiçbir
 * davranışı değiştirmez.
 *
 * Sunucu bileşenidir — durumu yoktur, salt işaretlemedir. Yalnızca imleci
 * izleyen parlamanın konumu istemci tarafında güncellenir (`CamParlama`).
 */
export default function CamKatmanlari() {
  return (
    <>
      {/* 1 — buzlu taban: herkeste çalışan zemin */}
      <span aria-hidden className="cam-katman cam-taban" />
      {/* 2 — kırılma: destekleyen tarayıcıda arka planı kenarda büker */}
      <span aria-hidden className="cam-katman cam-kirilma" />
      {/* 3 — gövde rengi */}
      <span aria-hidden className="cam-katman cam-renk" />
      {/* 4 — imleci izleyen parlama */}
      <span aria-hidden className="cam-katman cam-parlama" />
      {/* 5 — 1px ışıklı kenar */}
      <span aria-hidden className="cam-katman cam-kenar" />
    </>
  );
}
