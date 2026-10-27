import {create,parseDependencies} from 'mathjs';
const {parse}=create({parseDependencies});
export type CivilYear={year:number;era:'BCE'|'CE';approximate?:boolean};
export type CalculationInput={input:string;mode?:'auto'|'scientific'|'historical';angle_unit?:'degrees'|'radians';decimal?:','|'.';dates?:{from:CivilYear;to:CivilYear}};
const fail=(message:string):never=>{throw Object.assign(Error(message),{code:'CALCULATION_INPUT'});};
function civil(v:CivilYear){if(!Number.isSafeInteger(v.year)||v.year<1||v.year>100000||!['BCE','CE'].includes(v.era))fail('Use anos civis inteiros de 1 a 100.000 e uma era explícita. Não existe ano zero.');return v.era==='BCE'?1-v.year:v.year;}
const label=(v:CivilYear)=>`${v.approximate?'cerca de ':''}${v.year} ${v.era==='BCE'?'a.C.':'d.C.'}`;
export function parseHistorical(input:string){
 const uncertainty=/\?|~|≈|cerca|circa|aprox|\bca\.?\s/i,halves=input.split(/[–—-]|\s+(?:até|a|to)\s+/i);
 const clean=input.normalize('NFC').replace(/\./g,'').replace(/(?:cerca de|circa|aproximadamente|aprox|\bca\b|[?~≈])/gi,'').trim();
 const era='(BCE|BC|AEC|AC|CE|AD|EC|DC)',match=new RegExp(`^(\\d{1,6})\\s*${era}?\\s*(?:[–—-]|até|a|to)\\s*(\\d{1,6})\\s*${era}?$`,'i').exec(clean);
 if(!match||!match[2]&&!match[4])fail('Informe dois anos e suas eras, por exemplo 429 a.C. – 347 a.C. Confira os operandos antes de interpretar o intervalo.');
 const decode=(v:string)=>['BCE','BC','AEC','AC'].includes(v.toUpperCase())?'BCE':'CE';
 const from:CivilYear={year:Number(match![1]),era:decode(match![2]||match![4]),approximate:uncertainty.test(halves[0])},to:CivilYear={year:Number(match![3]),era:decode(match![4]||match![2]),approximate:uncertainty.test(halves.slice(1).join(' '))};
 civil(from);civil(to);return {from,to,era_shared:!match![2]||!match![4]};
}
export function calculate(a:CalculationInput){
 if(typeof a.input!=='string'||a.input.length>512)fail('Limite de 512 caracteres por cálculo.');
 const input=a.input.trim();if(!input&&!a.dates)fail('Digite uma expressão ou intervalo de anos.');
 const historical=!!a.dates||a.mode==='historical'||a.mode!=='scientific'&&/\b(?:BCE|BC|AEC|AC|CE|AD|EC|DC)\b/i.test(input.replace(/\./g,''));
 if(historical){
  const dates=a.dates?{...a.dates,era_shared:false}:parseHistorical(input),from=civil(dates.from),to=civil(dates.to);
  if(to<from)fail('O segundo ano é anterior ao primeiro. Corrija a ordem dos operandos.');
  const value=to-from,approximate=!!dates.from.approximate||!!dates.to.approximate;
  return {kind:'historical' as const,input,dates,value,unit:'years',formatted:`${approximate?'Aproximadamente ':''}${value} ${value===1?'ano':'anos'}`,calculation:`${label(dates.from)} → ${label(dates.to)}: ${dates.from.era===dates.to.era?`${Math.max(dates.from.year,dates.to.year)} − ${Math.min(dates.from.year,dates.to.year)}`:`${dates.from.year} + ${dates.to.year} − 1`} = ${value}`,notice:'Intervalo entre anos civis, sem ano zero. Sem dia e mês, esta conta não estabelece idade exata nem comprova uma biografia.',approximate,convention:'civil_no_year_zero',engine:'araread-civil/1'};
 }
 const started=performance.now(),angle=a.angle_unit||'degrees',decimal=a.decimal||',';
 if(!['degrees','radians'].includes(angle)||![',','.'].includes(decimal))fail('Escolha graus/radianos e vírgula/ponto decimal.');
 let expression=input.replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-').replace(/π/g,'pi');
 if(decimal===','){if(/\d\.\d/.test(expression))fail('Use vírgula decimal ou altere a convenção para ponto.');expression=expression.replace(/(?<=\d),(?=\d)/g,'.');}
 if(!/^[\dA-Za-z.()+\-*/^%\s]+$/.test(expression)||expression.split('%').length>3)fail('Use apenas números, operações e funções permitidas; no máximo duas porcentagens.');
 if((expression.match(/\d+(?:\.\d+)?|[a-z]+|[^\s]/gi)||[]).length>128)fail('A expressão excede 128 tokens.');
 let depth=0;for(const char of expression){if(char==='('&&++depth>24)fail('Limite de 24 níveis de parênteses.');if(char===')')depth--;if(depth<0)fail('Confira os parênteses.');}if(depth)fail('Confira os parênteses.');
 let tree:any;try{tree=parse!(expression);}catch{fail('Expressão inválida. Confira os números, parênteses e operadores.');}
 let nodes=0;
 const finite=(v:number)=>{if(!Number.isFinite(v))fail('Resultado fora do domínio real ou divisão por zero.');if(Math.abs(v)>1e100)fail('Magnitude máxima: 10^100.');return v;};
 function visit(n:any,level=0):number{
  if(++nodes>128||level>32||performance.now()-started>50)fail('O cálculo excede o limite de complexidade ou tempo.');
  if(n.type==='ConstantNode'&&typeof n.value==='number')return finite(n.value);
  if(n.type==='SymbolNode'&&['pi','e'].includes(n.name))return n.name==='pi'?Math.PI:Math.E;
  if(n.type==='ParenthesisNode')return visit(n.content,level+1);
  if(n.type==='OperatorNode'){
   const op=n.fn;if(!['add','subtract','multiply','divide','pow','unaryMinus','unaryPlus'].includes(op))fail('Operação não permitida.');
   const values=n.args.map((v:any)=>visit(v,level+1)),[x,y]=values;
   if(['unaryMinus','unaryPlus'].includes(op)){if(values.length!==1)fail('Operação inválida.');return finite(op==='unaryMinus'?-x:x);}
   if(values.length!==2)fail('Operação inválida.');if(op==='divide'&&y===0)fail('Divisão por zero.');
   return finite(op==='add'?x+y:op==='subtract'?x-y:op==='multiply'?x*y:op==='divide'?x/y:x**y);
  }
  if(n.type==='FunctionNode'&&n.fn.type==='SymbolNode'&&n.args.length===1){
   const name=n.fn.name;if(!['sqrt','cbrt','abs','ln','log','log10','exp','sin','cos','tan','asin','acos','atan'].includes(name))fail('Função não permitida.');
   let x=visit(n.args[0],level+1);if(['sin','cos','tan'].includes(name)){if(Math.abs(x)>1e12)fail('Ângulo grande demais para precisão útil.');if(angle==='degrees')x*=Math.PI/180;if(name==='tan'&&Math.abs(Math.cos(x))<1e-14)fail('Tangente indefinida neste ângulo.');}
   const fn=({sqrt:Math.sqrt,cbrt:Math.cbrt,abs:Math.abs,ln:Math.log,log:Math.log10,log10:Math.log10,exp:Math.exp,sin:Math.sin,cos:Math.cos,tan:Math.tan,asin:Math.asin,acos:Math.acos,atan:Math.atan} as Record<string,(v:number)=>number>)[name];
   let value=fn(x);if(['asin','acos','atan'].includes(name)&&angle==='degrees')value*=180/Math.PI;return finite(value);
  }
  return fail('Somente expressões numéricas escalares são aceitas.');
 }
 const raw=visit(tree),value=Number(raw.toPrecision(12)),formatted=String(Object.is(value,-0)?0:value).replace('.',decimal);
 return {kind:'scientific' as const,input,expression,angle_unit:angle,decimal,value,formatted,calculation:`${input} = ${formatted}`,notice:'Até 12 algarismos significativos, aritmética de ponto flutuante. Potências precedem sinal unário e associam à direita. log é base 10; ln é natural. x% = x/100; em soma/subtração, 200 + 10% = 220. Sem separador de milhares.',engine:'mathjs-parser/15.2.0 + scalar-whitelist/1'};
}
