export function calendarRange(period, day) {
 if (!['day','week','month'].includes(period) || typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw Error('Período inválido.');
 const date = new Date(day+'T12:00:00Z');
 if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== day) throw Error('Data inválida.');
 const first = new Date(date), last = new Date(date);
 if (period === 'week') { first.setUTCDate(date.getUTCDate()-(date.getUTCDay()+6)%7); last.setTime(first.getTime()); last.setUTCDate(first.getUTCDate()+6); }
 if (period === 'month') { first.setUTCDate(1); last.setUTCMonth(date.getUTCMonth()+1,0); }
 return {from:first.toISOString().slice(0,10),through:last.toISOString().slice(0,10)};
}
export function calendarTasks(tasks, period, day) {
 const range = calendarRange(period,day);
 return {...range,tasks:tasks.filter(t=>t.due>=range.from&&t.due<=range.through&&t.status!=='cancelled').sort((a,b)=>a.due.localeCompare(b.due)||a.title.localeCompare(b.title,'pt-BR'))};
}
