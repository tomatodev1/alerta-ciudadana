import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { ChartConfiguration } from 'chart.js';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useEstilosLanding } from '@/features/landing/hooks';
import { ETIQUETA_CORTA, useTipos } from '@/features/alertas/comun';
import type { Alerta, EstadoAlerta } from '@/types/database.types';
import { COLOR, Grafico } from './Grafico';
import { OTRAS, ZONAS, zonaDe } from './zonas';

type Fila = Pick<Alerta, 'id' | 'codigo' | 'tipo_id' | 'estado' | 'recibida_en' | 'finalizada_en' | 'direccion'>;

const DIA = 86_400_000;
const POR_PAGINA = 10;
const PENDIENTES: EstadoAlerta[] = ['enviada', 'recibida', 'en_evaluacion', 'en_atencion'];
const ZONA_LIMA = 'America/Lima';

const minutos = (a: Fila) => a.finalizada_en ? (new Date(a.finalizada_en).getTime() - new Date(a.recibida_en).getTime()) / 60_000 : null;
const fecha = (d: Date | string) => new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: ZONA_LIMA });
const fechaHora = (d: string) => new Date(d).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: ZONA_LIMA });
const nf = new Intl.NumberFormat('es-PE');

/** Lee las alertas del último año en bloques de 1000 (límite por consulta de Supabase). */
async function cargarAlertas(): Promise<Fila[]> {
  const desde = new Date(Date.now() - 365 * DIA).toISOString();
  const todas: Fila[] = [];
  for (let desdeFila = 0; ; desdeFila += 1000) {
    const { data, error } = await supabase.from('alertas')
      .select('id, codigo, tipo_id, estado, recibida_en, finalizada_en, direccion')
      .gte('recibida_en', desde).order('recibida_en', { ascending: false })
      .range(desdeFila, desdeFila + 999);
    if (error) throw error;
    todas.push(...(data ?? []));
    if (!data || data.length < 1000) return todas;
  }
}

/**
 * Dashboard de monitoreo de alertas (gestores MININTER / Central 105).
 * Conserva la estructura y el estilo del dashboard original de la landing (Bootstrap).
 * Lee datos reales de la tabla alertas y se actualiza en tiempo real.
 */
export default function DashboardPage() {
  useEstilosLanding();
  const { perfil, cerrarSesion } = useAuth();
  const navigate = useNavigate();
  const { tipos } = useTipos();

  const [alertas, setAlertas] = useState<Fila[] | null>(null);
  const [error, setError] = useState('');
  const [actualizado, setActualizado] = useState<Date | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [periodo, setPeriodo] = useState(90);
  const [pagina, setPagina] = useState(0);

  const recargar = useCallback(async () => {
    try {
      setAlertas(await cargarAlertas());
      setActualizado(new Date());
      setError('');
    } catch {
      setError('No se pudieron cargar los datos. Revisa tu conexión y recarga la página.');
    }
  }, []);

  useEffect(() => { void recargar(); }, [recargar]);

  // Tiempo real: cualquier alerta nueva o cambio de estado actualiza el panel (con 2 s de espera para agrupar cambios).
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const canal = supabase.channel('dashboard-alertas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alertas' }, () => {
        clearTimeout(t);
        t = setTimeout(() => void recargar(), 2000);
      })
      .subscribe();
    return () => { clearTimeout(t); void supabase.removeChannel(canal); };
  }, [recargar]);

  useEffect(() => {
    const anterior = document.title;
    document.title = 'Dashboard de monitoreo de alertas – AlertaCiudadana (Prototipo académico)';
    return () => { document.title = anterior; };
  }, []);

  useEffect(() => { setPagina(0); }, [filtroTipo, periodo]);

  const nombreTipo = useCallback((id: number) => tipos?.find((t) => t.id === id)?.nombre ?? `Tipo ${id}`, [tipos]);

  // ---------- Datos filtrados y agregados ----------
  const datos = useMemo(() => {
    const desde = Date.now() - periodo * DIA;
    const filtradas = (alertas ?? []).filter((a) =>
      new Date(a.recibida_en).getTime() >= desde && (filtroTipo === 'todos' || String(a.tipo_id) === filtroTipo));

    const atendidas = filtradas.filter((a) => a.estado === 'finalizada');
    const pendientes = filtradas.filter((a) => PENDIENTES.includes(a.estado));
    const canceladas = filtradas.length - atendidas.length - pendientes.length;
    const tiempos = atendidas.map(minutos).filter((m): m is number => m !== null);
    const promedio = tiempos.length ? tiempos.reduce((s, m) => s + m, 0) / tiempos.length : 0;

    // Por tipo (atendidas y pendientes)
    const porTipo = (tipos ?? []).map((t) => ({
      id: t.id,
      nombre: t.nombre,
      atendidas: atendidas.filter((a) => a.tipo_id === t.id).length,
      pendientes: pendientes.filter((a) => a.tipo_id === t.id).length,
    }));

    // Por zona (de mayor a menor)
    const conteoZona = new Map<string, number>();
    filtradas.forEach((a) => { const z = zonaDe(a.direccion).zona; conteoZona.set(z, (conteoZona.get(z) ?? 0) + 1); });
    const porZona = [...ZONAS, OTRAS].map((z) => ({ zona: z, total: conteoZona.get(z) ?? 0 }))
      .filter((z) => z.total > 0 || z.zona !== OTRAS)
      .sort((a, b) => b.total - a.total);

    // Evolución: por día (30 días), por semana (≤ 6 meses) o por mes (12 meses)
    const unidad: 'dia' | 'semana' | 'mes' = periodo <= 30 ? 'dia' : periodo <= 180 ? 'semana' : 'mes';
    const cubetas = new Map<string, number>();
    const etiquetas: string[] = [];
    const inicioDe = (d: Date) => {
      const x = new Date(d); x.setHours(0, 0, 0, 0);
      if (unidad === 'semana') x.setDate(x.getDate() - ((x.getDay() + 6) % 7));   // lunes
      if (unidad === 'mes') x.setDate(1);
      return x;
    };
    const etiquetaDe = (d: Date) => unidad === 'mes'
      ? d.toLocaleDateString('es-PE', { month: 'short', year: '2-digit' })
      : d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
    for (let d = inicioDe(new Date(desde)); d.getTime() <= Date.now();) {
      const k = etiquetaDe(d);
      etiquetas.push(k);
      cubetas.set(k, 0);
      if (unidad === 'dia') d.setDate(d.getDate() + 1);
      else if (unidad === 'semana') d.setDate(d.getDate() + 7);
      else d.setMonth(d.getMonth() + 1);
    }
    filtradas.forEach((a) => {
      const k = etiquetaDe(inicioDe(new Date(a.recibida_en)));
      if (cubetas.has(k)) cubetas.set(k, cubetas.get(k)! + 1);
    });

    return {
      filtradas, atendidas, pendientes, canceladas, promedio, porTipo, porZona, unidad,
      evolucion: { etiquetas, valores: etiquetas.map((k) => cubetas.get(k) ?? 0) },
      desde: new Date(desde),
    };
  }, [alertas, filtroTipo, periodo, tipos]);

  const totalPaginas = Math.max(1, Math.ceil(datos.filtradas.length / POR_PAGINA));
  const filasPagina = datos.filtradas.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);
  const pct = (n: number) => (datos.filtradas.length ? Math.round((n / datos.filtradas.length) * 100) : 0);
  const nombreFiltro = filtroTipo === 'todos' ? 'todos los tipos' : nombreTipo(Number(filtroTipo));
  const clave = `${filtroTipo}|${periodo}|${actualizado?.getTime() ?? 0}|${tipos?.length ?? 0}`;

  async function salir() {
    await cerrarSesion();
    navigate('/', { replace: true });
  }

  // ---------- Configuración de gráficos ----------
  const ejes = {
    grid: { color: COLOR.rejilla },
    border: { display: false },
    ticks: { color: COLOR.textoSec, precision: 0 },
  };

  const graficoTipo: ChartConfiguration<'bar'> = {
    type: 'bar',
    data: {
      labels: datos.porTipo.map((t) => t.nombre),
      datasets: [
        { label: 'Atendidas', data: datos.porTipo.map((t) => t.atendidas), backgroundColor: COLOR.serie1, borderColor: COLOR.superficie, borderWidth: { top: 2 }, borderRadius: 4, borderSkipped: 'start', maxBarThickness: 48 },
        { label: 'Pendientes', data: datos.porTipo.map((t) => t.pendientes), backgroundColor: COLOR.serie2, borderColor: COLOR.superficie, borderWidth: { top: 2 }, borderRadius: 4, borderSkipped: 'start', maxBarThickness: 48 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: { x: { ...ejes, stacked: true, grid: { display: false } }, y: { ...ejes, stacked: true, beginAtZero: true } },
      plugins: { legend: { position: 'top', align: 'end', labels: { boxWidth: 12, boxHeight: 12, useBorderRadius: true, borderRadius: 3 } }, tooltip: { mode: 'index', intersect: false } },
      onClick: (_e, elementos) => {
        const i = elementos[0]?.index;
        if (i !== undefined) setFiltroTipo(String(datos.porTipo[i].id));
      },
      onHover: (e, elementos) => { (e.native?.target as HTMLElement | undefined)?.style.setProperty('cursor', elementos.length ? 'pointer' : 'default'); },
    },
  };

  const graficoZona: ChartConfiguration<'bar'> = {
    type: 'bar',
    data: {
      labels: datos.porZona.map((z) => z.zona),
      datasets: [{ label: 'Alertas', data: datos.porZona.map((z) => z.total), backgroundColor: COLOR.serie1, borderRadius: 4, borderSkipped: 'start', maxBarThickness: 28 }],
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      scales: { x: { ...ejes, beginAtZero: true }, y: { ...ejes, grid: { display: false } } },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${nf.format(c.parsed.x)} alertas` } } },
    },
  };

  const graficoEvolucion: ChartConfiguration<'line'> = {
    type: 'line',
    data: {
      labels: datos.evolucion.etiquetas,
      datasets: [{
        label: 'Alertas registradas', data: datos.evolucion.valores, borderColor: COLOR.serie1, backgroundColor: 'rgba(42, 120, 214, 0.10)',
        fill: true, borderWidth: 2, tension: 0.25, pointRadius: datos.evolucion.etiquetas.length > 40 ? 0 : 3, pointHoverRadius: 5, pointBackgroundColor: COLOR.serie1,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      scales: { x: { ...ejes, grid: { display: false }, ticks: { ...ejes.ticks, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } }, y: { ...ejes, beginAtZero: true } },
      plugins: { legend: { display: false } },
    },
  };

  const textoUnidad = datos.unidad === 'dia' ? 'día' : datos.unidad === 'semana' ? 'semana' : 'mes';
  const resumenTipo = datos.porTipo.map((t) => `${t.nombre}: ${t.atendidas} atendidas, ${t.pendientes} pendientes`).join('; ');
  const resumenZona = datos.porZona.map((z) => `${z.zona}: ${z.total}`).join('; ');
  const picos = datos.evolucion.valores.length ? Math.max(...datos.evolucion.valores) : 0;

  return (
    <div className="landing dashboard">
      <a href="#contenido" className="skip-link">Saltar al contenido principal</a>

      <div className="aviso-prototipo py-2" role="note">
        <div className="container d-flex align-items-center gap-2">
          <i className="bi bi-exclamation-triangle-fill" aria-hidden="true"></i>
          <span><strong>Prototipo académico.</strong> No sustituye los canales oficiales de emergencia (105 · 116 · 106).</span>
        </div>
      </div>

      <nav className="navbar navbar-expand navbar-dark navbar-ac sticky-top" aria-label="Navegación principal">
        <div className="container">
          <Link className="navbar-brand d-flex align-items-center gap-2 fw-bold" to="/">
            <span className="brand-logo" aria-hidden="true"><i className="bi bi-broadcast"></i></span>
            <span className="d-none d-sm-inline">AlertaCiudadana</span>
          </Link>
          <ul className="navbar-nav ms-auto gap-1 gap-md-2 align-items-center">
            <li className="nav-item d-none d-md-block"><Link className="nav-link" to="/"><i className="bi bi-house-door" aria-hidden="true"></i> Inicio</Link></li>
            <li className="nav-item d-none d-lg-block"><Link className="nav-link" to="/central"><i className="bi bi-headset" aria-hidden="true"></i> Central 105</Link></li>
            <li className="nav-item"><Link className="nav-link active" aria-current="page" to="/dashboard"><i className="bi bi-bar-chart-line" aria-hidden="true"></i> Dashboard</Link></li>
            <li className="nav-item d-flex align-items-center ms-lg-2">
              <span className="text-white small me-2 d-none d-md-inline"><i className="bi bi-person-circle" aria-hidden="true"></i> {perfil ? `${perfil.nombres} ${perfil.apellidos}` : ''}</span>
              <button type="button" className="btn btn-light btn-sm fw-semibold" onClick={salir}>
                <i className="bi bi-box-arrow-right" aria-hidden="true"></i> <span className="d-none d-sm-inline">Cerrar sesión</span><span className="visually-hidden d-sm-none">Cerrar sesión</span>
              </button>
            </li>
          </ul>
        </div>
      </nav>

      <header className="dash-header">
        <div className="container d-flex flex-wrap justify-content-between align-items-end gap-2">
          <div>
            <span className="eyebrow">Monitoreo</span>
            <h1 className="h2 fw-bold section-title mb-1">Panel de monitoreo de alertas</h1>
            <p className="mb-0">
              Del {fecha(datos.desde)} al {fecha(new Date())} · {nombreFiltro} · {nf.format(datos.filtradas.length)} alertas
            </p>
          </div>
          <span className="badge badge-fuente px-3 py-2">
            <i className="bi bi-database" aria-hidden="true"></i> Fuente: base de datos AlertaCiudadana
            {actualizado && <> · actualizado {actualizado.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</>}
          </span>
        </div>
      </header>

      <main id="contenido" className="container pb-4 dash-sube">
        {/* Filtros */}
        <section className="filtros-bar p-3 mb-4" aria-labelledby="tFiltros">
          <h2 id="tFiltros" className="visually-hidden">Filtros</h2>
          <div className="row g-3 align-items-end">
            <div className="col-md-4">
              <label htmlFor="filtroTipo" className="form-label fw-semibold mb-1"><i className="bi bi-funnel" aria-hidden="true"></i> Tipo de emergencia</label>
              <select id="filtroTipo" className="form-select" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
                <option value="todos">Todos los tipos</option>
                {(tipos ?? []).map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </div>
            <div className="col-md-4">
              <label htmlFor="filtroPeriodo" className="form-label fw-semibold mb-1"><i className="bi bi-calendar3" aria-hidden="true"></i> Periodo</label>
              <select id="filtroPeriodo" className="form-select" value={periodo} onChange={(e) => setPeriodo(Number(e.target.value))}>
                <option value={30}>Últimos 30 días</option>
                <option value={90}>Últimos 3 meses</option>
                <option value={180}>Últimos 6 meses</option>
                <option value={365}>Últimos 12 meses</option>
              </select>
            </div>
            <div className="col-md-4 d-flex gap-2">
              <button type="button" className="btn btn-ac-outline w-100" onClick={() => { setFiltroTipo('todos'); setPeriodo(90); }}>
                <i className="bi bi-arrow-counterclockwise" aria-hidden="true"></i> Restablecer filtros
              </button>
            </div>
          </div>
          <p className="small text-muted-ac mb-0 mt-2" aria-live="polite">
            {error || (alertas ? `Mostrando ${nf.format(datos.filtradas.length)} alertas de ${nombreFiltro}.` : 'Cargando datos…')}
          </p>
        </section>

        {/* KPI */}
        <section aria-labelledby="tKpi" className="mb-4">
          <h2 id="tKpi" className="visually-hidden">Indicadores clave</h2>
          <div className="row g-3">
            <Kpi clase="" icono="bi-inbox-fill" titulo="Alertas registradas" valor={nf.format(datos.filtradas.length)} unidad="alertas"
              sub={`Promedio de ${(datos.filtradas.length / periodo).toFixed(1)} por día`} />
            <Kpi clase="kpi-ok" icono="bi-check-circle-fill" titulo="Alertas atendidas" valor={nf.format(datos.atendidas.length)} unidad="alertas"
              sub={`${pct(datos.atendidas.length)} % del total${datos.canceladas ? ` · ${datos.canceladas} canceladas` : ''}`} />
            <Kpi clase="kpi-warn" icono="bi-hourglass-split" titulo="Alertas pendientes" valor={nf.format(datos.pendientes.length)} unidad="alertas"
              sub="Recibidas, en evaluación o en atención" />
            <Kpi clase="kpi-time" icono="bi-stopwatch-fill" titulo="Tiempo promedio de respuesta" valor={datos.promedio.toFixed(1)} unidad="minutos"
              sub="Desde el registro hasta el cierre (solo atendidas)" />
          </div>
        </section>

        {/* Gráficos */}
        <section aria-labelledby="tGraficos">
          <h2 id="tGraficos" className="visually-hidden">Gráficos</h2>
          <div className="row g-3">
            <div className="col-lg-6">
              <div className="card card-ac p-3 h-100">
                <h3 className="h6 fw-bold mb-0">Alertas por tipo de emergencia</h3>
                <p className="small text-muted-ac mb-2">Número de alertas (atendidas y pendientes). Clic en una barra para filtrar por ese tipo.</p>
                <div className="chart-box">
                  {alertas && tipos && <Grafico config={graficoTipo as ChartConfiguration} clave={`tipo|${clave}`} etiqueta={`Alertas por tipo. ${resumenTipo}`} />}
                </div>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="card card-ac p-3 h-100">
                <h3 className="h6 fw-bold mb-0">Alertas por zona geográfica</h3>
                <p className="small text-muted-ac mb-2">Número de alertas por zona de Lima Metropolitana y Callao.</p>
                <div className="chart-box">
                  {alertas && <Grafico config={graficoZona as ChartConfiguration} clave={`zona|${clave}`} etiqueta={`Alertas por zona. ${resumenZona}`} />}
                </div>
              </div>
            </div>
            <div className="col-12">
              <div className="card card-ac p-3">
                <h3 className="h6 fw-bold mb-0">Evolución temporal de alertas</h3>
                <p className="small text-muted-ac mb-2">Alertas registradas por {textoUnidad} · máximo de {picos} en un {textoUnidad}.</p>
                <div className="chart-box">
                  {alertas && <Grafico config={graficoEvolucion as ChartConfiguration} clave={`evol|${clave}`} etiqueta={`Evolución de alertas por ${textoUnidad}. Máximo: ${picos}.`} />}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Detalle de alertas */}
        <section aria-labelledby="tTabla" className="mt-3">
          <div className="card card-ac p-3">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
              <div>
                <h2 id="tTabla" className="h6 fw-bold mb-0">Detalle de alertas</h2>
                <p className="small text-muted-ac mb-0">Registros según los filtros aplicados (más recientes primero).</p>
              </div>
            </div>
            <div className="table-responsive">
              <table className="table table-hover table-sm align-middle mb-2">
                <thead className="table-light">
                  <tr><th scope="col">Código</th><th scope="col">Fecha</th><th scope="col">Tipo</th><th scope="col">Zona</th><th scope="col">Estado</th><th scope="col" className="text-end">Tiempo de respuesta (min)</th></tr>
                </thead>
                <tbody>
                  {filasPagina.map((a) => {
                    const z = zonaDe(a.direccion);
                    const m = minutos(a);
                    return (
                      <tr key={a.id}>
                        <td className="font-monospace small">{a.codigo}</td>
                        <td className="text-nowrap">{fechaHora(a.recibida_en)}</td>
                        <td>{nombreTipo(a.tipo_id)}</td>
                        <td>{z.zona}{z.distrito !== '—' && <span className="d-block small text-muted-ac">{z.distrito}</span>}</td>
                        <td><EstadoBadge estado={a.estado} /></td>
                        <td className="text-end">{m !== null && a.estado === 'finalizada' ? m.toFixed(0) : '—'}</td>
                      </tr>
                    );
                  })}
                  {alertas && filasPagina.length === 0 && (
                    <tr><td colSpan={6} className="text-center text-muted-ac py-4">No hay alertas con estos filtros.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <nav className="d-flex flex-wrap gap-2 justify-content-between align-items-center" aria-label="Paginación de la tabla">
              <span className="small text-muted-ac" aria-live="polite">
                Página {pagina + 1} de {totalPaginas} · {nf.format(datos.filtradas.length)} registros
              </span>
              <div className="btn-group">
                <button type="button" className="btn btn-sm btn-ac-outline" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>
                  <i className="bi bi-chevron-left" aria-hidden="true"></i> Anterior
                </button>
                <button type="button" className="btn btn-sm btn-ac-outline" disabled={pagina >= totalPaginas - 1} onClick={() => setPagina((p) => p + 1)}>
                  Siguiente <i className="bi bi-chevron-right" aria-hidden="true"></i>
                </button>
              </div>
            </nav>
          </div>
        </section>
      </main>

      <footer className="landing-footer py-4 mt-4">
        <div className="container d-flex flex-column flex-md-row justify-content-between gap-2 small">
          <span>© 2026 AlertaCiudadana · Prototipo académico – Grupo 6. No sustituye los canales oficiales de emergencia.</span>
          <Link to="/">← Volver a la Landing Page</Link>
        </div>
      </footer>
    </div>
  );
}

function Kpi({ clase, icono, titulo, valor, unidad, sub }: { clase: string; icono: string; titulo: string; valor: string; unidad: string; sub: string }) {
  return (
    <div className="col-sm-6 col-xl-3">
      <div className={`card card-ac kpi-card ${clase} p-3 h-100`}>
        <div className="d-flex justify-content-between align-items-start mb-2">
          <div className="small fw-semibold text-muted-ac">{titulo}</div>
          <span className="kpi-icono" aria-hidden="true"><i className={`bi ${icono}`}></i></span>
        </div>
        <div><span className="kpi-valor">{valor}</span> <span className="kpi-unidad">{unidad}</span></div>
        <div className="small text-muted-ac">{sub}</div>
      </div>
    </div>
  );
}

function EstadoBadge({ estado }: { estado: EstadoAlerta }) {
  if (estado === 'finalizada') return <span className="badge text-bg-success"><i className="bi bi-check-circle" aria-hidden="true"></i> Atendida</span>;
  if (estado === 'cancelada') return <span className="badge text-bg-secondary"><i className="bi bi-x-circle" aria-hidden="true"></i> Cancelada</span>;
  return <span className="badge text-bg-warning"><i className="bi bi-hourglass-split" aria-hidden="true"></i> {ETIQUETA_CORTA[estado]}</span>;
}
