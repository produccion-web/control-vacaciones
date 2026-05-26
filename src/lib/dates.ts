import { HOLIDAYS_BY_YEAR } from '../data/holidays'
export function parseLocalDate(str: string) { const [y,m,d]=str.split('-').map(Number); return new Date(y,m-1,d,12,0,0) }
export function dateToISO(date: Date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}` }
export function formatDate(str: string) { const d=parseLocalDate(str); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}` }
export function eachDate(startStr: string, endStr: string) { const out:string[]=[]; const d=parseLocalDate(startStr); const end=parseLocalDate(endStr); while(d<=end){out.push(dateToISO(d)); d.setDate(d.getDate()+1)} return out }
export function getHolidayMap(year: number) { return Object.fromEntries((HOLIDAYS_BY_YEAR[year]||[]).map(([date,name])=>[date,name])) as Record<string,string> }
export function calculateVacationDays(startStr: string, endStr: string, year: number) {
  if (!startStr || !endStr || endStr < startStr) return null
  const allDates=eachDate(startStr,endStr); const holidayMap=getHolidayMap(year)
  const weekendDates=allDates.filter(d=>{const wd=parseLocalDate(d).getDay(); return wd===0||wd===6})
  const workableDates=allDates.filter(d=>{const wd=parseLocalDate(d).getDay(); return wd!==0&&wd!==6})
  const holidayDates=workableDates.filter(d=>holidayMap[d]); const consumedDates=workableDates.filter(d=>!holidayMap[d])
  return { naturalDays: allDates.length, workableDays: workableDates.length, weekendDays: weekendDates.length, holidayDates, consumedDates, consumedDays: consumedDates.length, excludedDates: [...weekendDates,...holidayDates].sort() }
}
export const MONTHS=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
