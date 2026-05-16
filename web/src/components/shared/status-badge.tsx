const STATUS_MAP: Record<string, { bg: string; color: string; label: string }> = {
  "Pagado": { bg: "#dcfce7", color: "#166534", label: "Pagado" },
  "Pendiente": { bg: "#fef9c3", color: "#854d0e", label: "Pendiente" },
  "Vencido": { bg: "#fee2e2", color: "#991b1b", label: "Vencido" },
  "En proceso": { bg: "#dbeafe", color: "#1e40af", label: "En proceso" },
  "Recibido": { bg: "#dcfce7", color: "#166534", label: "Recibido" },
  "En tránsito": { bg: "#dbeafe", color: "#1e40af", label: "En tránsito" },
  "Cancelado": { bg: "#f3f4f6", color: "#6b7280", label: "Cancelado" },
  "Activo": { bg: "#dcfce7", color: "#166534", label: "Activo" },
  "Inactivo": { bg: "#f3f4f6", color: "#6b7280", label: "Inactivo" },
  "OK": { bg: "#dcfce7", color: "#166534", label: "OK" },
  "Bajo": { bg: "#fef9c3", color: "#854d0e", label: "Stock Bajo" },
  "Agotado": { bg: "#fee2e2", color: "#991b1b", label: "Agotado" },
  "Por vencer": { bg: "#fef9c3", color: "#854d0e", label: "Por vencer" },
}

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] || { bg: "#f3f4f6", color: "#6b7280", label: status }
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  )
}
