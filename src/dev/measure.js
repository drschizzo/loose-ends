const OLD = await load('/src/dev/plan.json');
const rows = P.measure(OLD.slice(0, 37), (r) => console.log('row ' + JSON.stringify(r)));
console.log('rows ' + JSON.stringify(rows));
return rows;
