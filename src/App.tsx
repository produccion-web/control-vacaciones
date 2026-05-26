import { useEffect, useMemo, useState } from 'react'
import { Building2, CalendarDays, LogOut, Plus, Trash2, Users } from 'lucide-react'
import { supabase } from './lib/supabase'
import { calculateVacationDays, dateToISO, formatDate, getHolidayMap, MONTHS } from './lib/dates'
import { HOLIDAYS_BY_YEAR } from './data/holidays'

type Org = { id: string; name: string }
type Member = { organization_id: string; role: 'owner' | 'admin' | 'member'; organizations: Org }
type Employee = { id: string; organization_id: string; name: string; annual_days: number }
type Vacation = { id: string; employee_id: string; start_date: string; end_date: string; year: number; consumed_days: number; workable_days: number; excluded_dates: string[]; employees?: Employee }

const WEEKDAYS = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']
const defaultYear = new Date().getFullYear()

function card(cls = '') { return `bg-white/95 border border-slate-200 rounded-3xl shadow-xl shadow-slate-200/60 ${cls}` }
function button(cls = '') { return `rounded-xl px-4 py-2 font-bold transition active:translate-y-px ${cls}` }

export default function App() {
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  const [authMode, setAuthMode] = useState<'login'|'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [memberships, setMemberships] = useState<Member[]>([])
  const [orgId, setOrgId] = useState('')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [vacations, setVacations] = useState<Vacation[]>([])
  const [newOrg, setNewOrg] = useState('')
  const [newEmployee, setNewEmployee] = useState('')
  const [year, setYear] = useState(HOLIDAYS_BY_YEAR[defaultYear] ? defaultYear : 2026)
  const [month, setMonth] = useState(new Date().getMonth())
  const [employeeId, setEmployeeId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessionEmail(data.session?.user.email ?? null)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setSessionEmail(session?.user.email ?? null))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => { if (sessionEmail) loadMemberships() }, [sessionEmail])
  useEffect(() => { if (orgId) loadOrgData() }, [orgId, year])

  async function loadMemberships() {
    const { data, error } = await supabase.from('organization_members').select('organization_id, role, organizations(id, name)').order('created_at')
    if (error) return alert(error.message)
    const rows = (data ?? []) as unknown as Member[]
    setMemberships(rows)
    if (!orgId && rows[0]) setOrgId(rows[0].organization_id)
  }

  async function loadOrgData() {
    const [{ data: emps, error: empErr }, { data: vacs, error: vacErr }] = await Promise.all([
      supabase.from('employees').select('*').eq('organization_id', orgId).order('name'),
      supabase.from('vacations').select('*, employees(*)').eq('organization_id', orgId).eq('year', year).order('start_date')
    ])
    if (empErr || vacErr) return alert(empErr?.message || vacErr?.message)
    setEmployees((emps ?? []) as Employee[])
    setVacations((vacs ?? []) as Vacation[])
  }

  async function signInOrUp() {
    const credentials = { email, password }
    const { error } = authMode === 'login'
      ? await supabase.auth.signInWithPassword(credentials)
      : await supabase.auth.signUp(credentials)

    if (error) alert(error.message)
  }

  async function createOrg() {
    if (!newOrg.trim()) return
    const { error } = await supabase.rpc('create_organization_with_owner', { org_name: newOrg.trim() })
    if (error) return alert(error.message)
    setNewOrg('')
    await loadMemberships()
  }

  async function addEmployee() {
    if (!newEmployee.trim() || !orgId) return
    const { error } = await supabase.from('employees').insert({ organization_id: orgId, name: newEmployee.trim(), annual_days: 22 })
    if (error) return alert(error.message)
    setNewEmployee('')
    loadOrgData()
  }

  async function removeEmployee(id: string) {
    if (!confirm('Se eliminará el trabajador y sus vacaciones.')) return
    const { error } = await supabase.from('employees').delete().eq('id', id)
    if (error) return alert(error.message)
    loadOrgData()
  }

  async function addVacation() {
    if (!employeeId || !startDate || !endDate) return alert('Faltan datos para guardar vacaciones.')
    if (startDate.slice(0,4) !== String(year) || endDate.slice(0,4) !== String(year)) return alert('Las fechas deben estar dentro del año seleccionado.')
    const calc = calculateVacationDays(startDate, endDate, year)
    if (!calc) return alert('Rango no válido.')
    const overlap = vacations.some(v => v.employee_id === employeeId && !(endDate < v.start_date || startDate > v.end_date))
    if (overlap && !confirm('Este trabajador ya tiene vacaciones que se solapan. ¿Guardar igualmente?')) return
    const { error } = await supabase.from('vacations').insert({ organization_id: orgId, employee_id: employeeId, start_date: startDate, end_date: endDate, year, consumed_days: calc.consumedDays, workable_days: calc.workableDays, excluded_dates: calc.excludedDates })
    if (error) return alert(error.message)
    setStartDate(''); setEndDate('')
    loadOrgData()
  }

  async function removeVacation(id: string) {
    const { error } = await supabase.from('vacations').delete().eq('id', id)
    if (error) return alert(error.message)
    loadOrgData()
  }

  const totals = useMemo(() => Object.fromEntries(employees.map(e => {
    const used = vacations.filter(v => v.employee_id === e.id).reduce((s,v)=>s+v.consumed_days,0)
    return [e.id, { used, remaining: e.annual_days - used }]
  })), [employees, vacations])

  const preview = startDate && endDate ? calculateVacationDays(startDate, endDate, year) : null
  const currentOrg = memberships.find(m => m.organization_id === orgId)?.organizations

  if (loading) return <div className="p-10">Cargando...</div>

  if (!sessionEmail) return <main className="min-h-screen grid place-items-center p-6"><section className={card('max-w-md w-full p-8')}>
    <div className="flex items-center gap-3 mb-6"><div className="p-3 rounded-2xl bg-blue-100"><CalendarDays /></div><div><h1 className="text-2xl font-black">Control vacaciones</h1><p className="text-slate-500">Multiempresa y multiusuario</p></div></div>
    <div className="grid gap-3"><input className="border rounded-xl p-3" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} /><input className="border rounded-xl p-3" placeholder="Contraseña" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
    <button className={button('bg-blue-600 text-white')} onClick={signInOrUp}>{authMode === 'login' ? 'Entrar' : 'Crear cuenta'}</button>
    <button className={button('bg-white border')} onClick={()=>setAuthMode(authMode === 'login' ? 'signup' : 'login')}>{authMode === 'login' ? 'Necesito crear cuenta' : 'Ya tengo cuenta'}</button></div>
  </section></main>

  return <main className="max-w-7xl mx-auto p-5 grid gap-5">
    <header className={card('p-6 flex flex-wrap items-center justify-between gap-4')}><div><h1 className="text-3xl font-black">Calendario de vacaciones</h1><p className="text-slate-500">Empresas aisladas por RLS, usuarios por membresía y cálculo de días laborables.</p></div><button className={button('bg-white border flex gap-2 items-center')} onClick={()=>supabase.auth.signOut()}><LogOut size={18}/>Salir</button></header>
    <section className="grid lg:grid-cols-[360px_1fr] gap-5">
      <aside className="grid gap-5 content-start">
        <div className={card('p-5')}><h2 className="font-black text-lg flex gap-2"><Building2/> Empresa</h2><select className="border rounded-xl p-3 mt-3 w-full" value={orgId} onChange={e=>setOrgId(e.target.value)}>{memberships.map(m=><option key={m.organization_id} value={m.organization_id}>{m.organizations.name} · {m.role}</option>)}</select><div className="flex gap-2 mt-3"><input className="border rounded-xl p-3 flex-1" placeholder="Nueva empresa" value={newOrg} onChange={e=>setNewOrg(e.target.value)} /><button className={button('bg-blue-600 text-white')} onClick={createOrg}><Plus size={18}/></button></div></div>
        <div className={card('p-5')}><h2 className="font-black text-lg flex gap-2"><Users/> Trabajadores</h2><div className="flex gap-2 mt-3"><input className="border rounded-xl p-3 flex-1" placeholder="Nombre" value={newEmployee} onChange={e=>setNewEmployee(e.target.value)} /><button className={button('bg-blue-600 text-white')} onClick={addEmployee}><Plus size={18}/></button></div><div className="grid gap-2 mt-4">{employees.map(e=><div key={e.id} className="border rounded-2xl p-3 bg-slate-50"><div className="flex justify-between"><b>{e.name}</b><span className={`rounded-full px-2 text-sm font-bold ${totals[e.id]?.remaining < 0 ? 'bg-red-100 text-red-700':'bg-green-100 text-green-700'}`}>{totals[e.id]?.used}/{e.annual_days}</span></div><button className="text-red-700 text-sm mt-2 flex gap-1" onClick={()=>removeEmployee(e.id)}><Trash2 size={15}/>Eliminar</button></div>)}</div></div>
        <div className={card('p-5')}><h2 className="font-black text-lg">Registrar vacaciones</h2><select className="border rounded-xl p-3 mt-3 w-full" value={employeeId} onChange={e=>setEmployeeId(e.target.value)}><option value="">Trabajador</option>{employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select><div className="grid grid-cols-2 gap-2 mt-3"><input className="border rounded-xl p-3" type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} /><input className="border rounded-xl p-3" type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} /></div><p className="text-sm text-slate-500 mt-3">{preview ? `${preview.consumedDays} días consumidos. ${preview.weekendDays} fines de semana y ${preview.holidayDates.length} festivos no cuentan.` : 'Selecciona fechas para calcular.'}</p><button className={button('bg-blue-600 text-white w-full mt-3')} onClick={addVacation}>Guardar vacaciones</button></div>
      </aside>
      <section className="grid gap-5"><CalendarPanel year={year} setYear={setYear} month={month} setMonth={setMonth} vacations={vacations} holidays={getHolidayMap(year)} onPick={(iso)=>{ if(!startDate || endDate){setStartDate(iso); setEndDate('')} else { iso < startDate ? (setEndDate(startDate), setStartDate(iso)) : setEndDate(iso) } }} startDate={startDate} endDate={endDate}/><div className={card('p-5 overflow-auto')}><h2 className="font-black text-lg mb-3">Detalle de vacaciones · {currentOrg?.name}</h2><table className="w-full text-sm"><thead><tr className="text-left text-slate-500"><th className="p-2">Trabajador</th><th>Periodo</th><th>Días</th><th>No contados</th><th></th></tr></thead><tbody>{vacations.map(v=><tr key={v.id} className="border-t"><td className="p-2 font-semibold">{v.employees?.name}</td><td>{formatDate(v.start_date)} → {formatDate(v.end_date)}</td><td><span className="bg-indigo-100 text-indigo-700 rounded-full px-2 font-bold">{v.consumed_days}</span></td><td className="text-slate-500">{v.excluded_dates?.length ? v.excluded_dates.map(formatDate).join(', ') : '0'}</td><td><button className="text-red-700" onClick={()=>removeVacation(v.id)}><Trash2 size={16}/></button></td></tr>)}</tbody></table></div></section>
    </section>
  </main>
}

function CalendarPanel({year,setYear,month,setMonth,vacations,holidays,onPick,startDate,endDate}: any) {
  const cells = getCalendarCells(year, month)
  const years = Object.keys(HOLIDAYS_BY_YEAR).map(Number)
  return <div className={card('p-5')}><div className="flex flex-wrap justify-between gap-3 mb-3"><div className="flex gap-2 items-center"><button className={button('bg-white border')} onClick={()=>setMonth((m:number)=> m===0 ? 11 : m-1)}>←</button><h2 className="font-black text-xl min-w-48 text-center">{MONTHS[month][0].toUpperCase()+MONTHS[month].slice(1)} {year}</h2><button className={button('bg-white border')} onClick={()=>setMonth((m:number)=> m===11 ? 0 : m+1)}>→</button></div><select className="border rounded-xl p-2" value={year} onChange={e=>setYear(Number(e.target.value))}>{years.map(y=><option key={y}>{y}</option>)}</select></div><div className="grid grid-cols-7 gap-2 mb-2">{WEEKDAYS.map(d=><div className="text-center text-xs font-black text-slate-500" key={d}>{d}</div>)}</div><div className="grid grid-cols-7 gap-2">{cells.map((c:any)=>{ const iso=dateToISO(c.date); const names=vacations.filter((v:Vacation)=>iso>=v.start_date&&iso<=v.end_date).map((v:Vacation)=>v.employees?.name); const inRange=startDate&&endDate&&iso>=startDate&&iso<=endDate; return <button key={iso+c.outside} onClick={()=>!c.outside&&onPick(iso)} className={`min-h-24 text-left border rounded-2xl p-2 bg-white ${c.outside?'opacity-30':'hover:shadow'} ${holidays[iso]?'bg-red-50':''} ${inRange?'outline outline-2 outline-blue-500 bg-blue-50':''}`}><b>{c.date.getDate()}</b><div className="mt-1 flex flex-wrap gap-1">{holidays[iso]&&<span className="text-[11px] bg-red-100 text-red-700 rounded-full px-2">{holidays[iso]}</span>}{names.slice(0,3).map((n:string,i:number)=><span key={i} className="text-[11px] bg-green-100 text-green-700 rounded-full px-2">{n}</span>)}</div></button>})}</div></div>
}
function getCalendarCells(year:number, monthIndex:number) { const first=new Date(year,monthIndex,1,12); const last=new Date(year,monthIndex+1,0,12); const firstWeekday=(first.getDay()+6)%7; const totalDays=last.getDate(); const cells=[]; for(let i=0;i<firstWeekday;i++) cells.push({date:new Date(year,monthIndex,1-(firstWeekday-i),12), outside:true}); for(let day=1;day<=totalDays;day++) cells.push({date:new Date(year,monthIndex,day,12), outside:false}); while(cells.length%7!==0){const offset=cells.length-(firstWeekday+totalDays)+1; cells.push({date:new Date(year,monthIndex,totalDays+offset,12), outside:true})} return cells }
