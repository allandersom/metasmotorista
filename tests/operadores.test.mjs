import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.window = {};
const {responsavelTurno} = await import('../src/business/operadores.js');
test('responsável é escolhido pelo turno e somente quando ativo',()=>{
 const lista=[{nome:'Anterior',turno:'dia',ativo:false},{nome:'Atual',turno:'dia',ativo:true},{nome:'Noite',turno:'noite',ativo:true}];
 assert.equal(responsavelTurno(lista,'dia').nome,'Atual');
 assert.equal(responsavelTurno(lista,'noite').nome,'Noite');
 assert.equal(responsavelTurno([],'dia'),null);
});
