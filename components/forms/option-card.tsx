/**
 * Opción tipo tarjeta con círculo de selección. Mismo marcado y estilos que el snippet
 * br-opcion.liquid del tema (shopify-theme/assets/br-opcion.css): un único componente para la web.
 * Radio nativo: una sola elegida por grupo (`name`), teclado y foco visibles.
 */
export function OptionCard({
  name,
  value,
  checked,
  onChange,
  title,
  description,
  dark
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  title: string;
  description?: string;
  dark?: boolean;
}) {
  return (
    <label className={dark ? 'br-opcion br-opcion--oscuro' : 'br-opcion'}>
      <input className="br-opcion__input" type="radio" name={name} value={value} checked={checked} onChange={() => onChange(value)} />
      <span className="br-opcion__marca" aria-hidden="true" />
      <span className="br-opcion__texto">
        <span className="br-opcion__titulo">{title}</span>
        {description && <span className="br-opcion__desc">{description}</span>}
      </span>
    </label>
  );
}
