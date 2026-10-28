import {el,field} from './ui.ts';
import {activityFeedback,type Passage} from '../editions/model.ts';

export function editionActivities(activities:Passage['activities'],integrated:boolean,save?: (args:any)=>Promise<any>){
 const root=el('details',{open:integrated},el('summary',{},'Praticar, se quiser'));
 for(const a of activities){
  const card=el('section'),result=el('div',{role:'status'}),response=['choice','classification'].includes(a.kind)&&a.options.length?el('select',{},el('option',{value:''},'Escolha uma resposta'),...a.options.map(o=>el('option',{value:o},o))):el('textarea',{rows:2,maxLength:3000});
  const self=el('select',{},el('option',{value:''},'Escolha depois de comparar'),el('option',{value:'again'},'Quero revisar'),el('option',{value:'partial'},'Atendi parte dos critérios'),el('option',{value:'satisfied'},'Considero os critérios atendidos'));
  card.append(el('h3',{},a.question));
  if(a.kind==='order')card.append(el('p',{},'Reorganize os itens abaixo e escreva um por linha na ordem escolhida.'),el('ul',{},...a.options.map(o=>el('li',{},o))));
  card.append(field('Minha resposta',response));
  if(a.kind==='open')card.append(el('p',{},`Critérios: ${a.criteria}`),el('details',{},el('summary',{},'Comparar com a referência'),el('p',{},a.answer),el('p',{},a.feedback)),field('Minha autoavaliação',self));
  const submit=el('button',{type:'button'},save?'Responder e guardar':'Conferir resposta');
  submit.onclick=async()=>{submit.disabled=true;try{
   if(!response.value.trim())throw Error('Escreva ou escolha sua resposta.');
   if(a.kind==='open'&&!self.value)throw Error('Compare com os critérios e registre sua autoavaliação.');
   const feedback=activityFeedback(a,response.value,self.value||undefined),saved=save?await save({activity_id:a.id,text:response.value,...(self.value?{self_assessment:self.value}:{})}):null;
   const shown=saved?.response||feedback;result.textContent=`${shown.correct===null?'Autoavaliação registrada; o significado não foi julgado automaticamente.':shown.correct?'Resposta confere com a referência.':'Confira a resposta de referência.'} ${shown.feedback} Referência: ${shown.answer}. ${shown.criteria}${saved?.status==='local'?' Registro somente neste dispositivo, aguardando confirmação.':''}`;
  }catch(e:any){result.textContent=e.message||'Não foi possível guardar a resposta.';}finally{submit.disabled=false;}};
  card.append(submit,result);root.append(card);
 }
 return root;
}
