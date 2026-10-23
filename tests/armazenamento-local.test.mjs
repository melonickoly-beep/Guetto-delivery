import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

const { outputText } = ts.transpileModule(readFileSync(new URL('../lib/armazenamento-local.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { armazenamentoLocal } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('armazenamento indisponível não interrompe abertura, carrinho ou limpeza', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  try {
    for (const windowMock of [
      { get localStorage() { throw new DOMException('Bloqueado', 'SecurityError'); } },
      { localStorage: {
        getItem() { throw new Error('Leitura bloqueada'); },
        setItem() { throw new DOMException('Sem espaço', 'QuotaExceededError'); },
        removeItem() { throw new Error('Remoção bloqueada'); },
      } },
    ]) {
      Object.defineProperty(globalThis, 'window', { configurable: true, value: windowMock });
      assert.equal(armazenamentoLocal.getItem('guetto_carrinho'), null);
      assert.doesNotThrow(() => armazenamentoLocal.setItem('guetto_carrinho', '[]'));
      assert.doesNotThrow(() => armazenamentoLocal.removeItem('guetto_carrinho'));
    }
    const dados = new Map();
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
      getItem: chave => dados.get(chave) ?? null,
      setItem: (chave, valor) => dados.set(chave, valor),
      removeItem: chave => dados.delete(chave),
    } } });
    armazenamentoLocal.setItem('guetto_carrinho', '[1]');
    assert.equal(armazenamentoLocal.getItem('guetto_carrinho'), '[1]');
    armazenamentoLocal.removeItem('guetto_carrinho');
    assert.equal(armazenamentoLocal.getItem('guetto_carrinho'), null);
  } finally {
    if (original) Object.defineProperty(globalThis, 'window', original);
    else delete globalThis.window;
  }
});
