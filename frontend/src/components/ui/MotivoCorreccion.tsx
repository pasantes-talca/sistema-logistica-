export default function MotivoCorreccion({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="campo campo-completo">
      <label htmlFor="motivo-correccion">Motivo de la corrección *</label>
      <textarea
        id="motivo-correccion"
        required
        maxLength={2000}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Explicá por qué modificás este registro. Quedará guardado en la auditoría."
      />
    </div>
  );
}
