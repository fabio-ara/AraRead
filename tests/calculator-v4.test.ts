import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calculate} from '../src/calculator.ts';
test('datas civis: eras, incerteza, operandos e ausência de ano zero',()=>{
 for(const input of ['429?–347 B.C.E.','cerca de 429–347 a.C.','429? a.E.C. a 347 a.E.C.']){const r=calculate({input});assert.equal(r.value,82);assert.equal(r.formatted,'Aproximadamente 82 anos');assert.match(r.notice,/não estabelece idade exata/);}
 for(const input of ['1 a.C. – 1 d.C.','1 BCE–1 CE','1 a.E.C. a 1 E.C.'])assert.equal(calculate({input}).value,1);
 assert.equal(calculate({input:'2000 CE – 2026 CE'}).value,26);assert.equal(calculate({input:'429–347 BCE'}).value,82);
 const uncertain=calculate({input:'429?–347 B.C.E.'});assert.equal(uncertain.kind==='historical'&&uncertain.dates.from.approximate,true);assert.equal(uncertain.kind==='historical'&&uncertain.dates.to.approximate,false);
 assert.equal(calculate({input:'',dates:{from:{year:2,era:'BCE'},to:{year:2,era:'CE',approximate:true}}}).value,3);
 for(const input of ['0 BCE–1 CE','347 BCE–429 BCE','429 BCE','429/347 BCE','429-347','42.9 BCE–34.7 BCE','42,9 BCE–34,7 BCE','4.29 a.C.–3.47 a.C.'])assert.throws(()=>calculate({input,mode:'historical'}));
});
test('científica: precedência, locale, porcentagem, trigonometria e arredondamento',()=>{
 const cases:Record<string,number>={'2+3*4':14,'(2+3)*4':20,'-2^2':-4,'2^3^2':512,'sqrt(81)+cbrt(27)':12,'200*10%':20,'200+10%':220,'log(100)+ln(e)':3,'sin(30)':0.5,'cos(60)':0.5,'asin(0,5)':30,'2,5*4':10,'0,1+0,2':0.3};
 for(const [input,value]of Object.entries(cases))assert.equal(calculate({input}).value,value,input);
 assert.equal(calculate({input:'sin(pi/2)',angle_unit:'radians'}).value,1);assert.equal(calculate({input:'2.5*4',decimal:'.'}).value,10);
});
test('domínio e entradas hostis são limitados antes da execução',()=>{
 for(const input of ['1/0','sqrt(-1)','ln(0)','tan(90)','asin(2)','10^101','9^9^9^9','sin(1e20)','a=3','import(1)','evaluate(1)','2;3','[1,2]','a.b','__proto__','constructor(1)','random()','factorial(10000)','sum(1:10000)','1%+2%+3%','('.repeat(25)+'1'+')'.repeat(25),'1'.repeat(513),'2.5+1'])assert.throws(()=>calculate({input}),{code:'CALCULATION_INPUT'},input);
});
