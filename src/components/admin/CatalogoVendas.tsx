import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase/config';
import { Plus, Edit2, Check, X, Search, ShoppingBag } from 'lucide-react';

interface ProdutoCatalogo {
  id: string;
  nome: string;
  modalidade: 'ONLINE' | 'PRESENCIAL';
  categoria_online?: 'MENTORIA' | 'CURSO_ONLINE' | 'SIMULADO';
  localidade_presencial?: 'RIO_BRANCO' | 'PORTO_VELHO';
  status: 'ATIVO' | 'EM PRODUÇÃO' | 'EXPIRADO';
  pitch: string;
  url: string;
  checkout: string;
  data_inicio?: string;
  quantidade_encontros?: string;
  valor_ancoragem?: string;
  valor_desconto_credito?: string;
  valor_desconto_pix?: string;
}

export default function CatalogoVendas() {
  const [produtos, setProdutos] = useState<ProdutoCatalogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [form, setForm] = useState<Partial<ProdutoCatalogo>>({
    nome: '',
    modalidade: 'ONLINE',
    categoria_online: 'CURSO_ONLINE',
    status: 'ATIVO',
    pitch: '',
    url: '',
    checkout: ''
  });

  useEffect(() => {
    carregarCatalogo();
  }, []);

  const carregarCatalogo = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'catalogo_vendas'));
      const querySnapshot = await getDocs(q);
      const docs: ProdutoCatalogo[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data() as any;
        let mod = data.modalidade;
        let cat = data.categoria_online;
        let loc = data.localidade_presencial;
        let st = data.status;

        if (mod === 'Online') { mod = 'ONLINE'; if (!cat) cat = 'CURSO_ONLINE'; }
        else if (mod === 'Presencial') { mod = 'PRESENCIAL'; if (!loc) loc = 'RIO_BRANCO'; }
        else if (mod === 'Mentoria') { mod = 'ONLINE'; cat = 'MENTORIA'; }

        if (st === 'Ativo') st = 'ATIVO';
        else if (st === 'Encerrado' || st === 'Esgotado') st = 'EXPIRADO';

        docs.push({ 
          id: doc.id,
          ...data,
          modalidade: mod,
          categoria_online: cat,
          localidade_presencial: loc,
          status: st 
        } as ProdutoCatalogo);
      });
      setProdutos(docs);
    } catch (e) {
      console.error("Erro ao carregar catálogo", e);
    } finally {
      setLoading(false);
    }
  };

  const handlesave = async () => {
    try {
      const dataToSave = { ...form };
      if (dataToSave.modalidade === 'ONLINE') {
         delete dataToSave.localidade_presencial;
      } else {
         delete dataToSave.categoria_online;
      }
      
      Object.keys(dataToSave).forEach(key => {
        if (dataToSave[key as keyof typeof dataToSave] === undefined) {
          delete dataToSave[key as keyof typeof dataToSave];
        }
      });

      if (editingId) {
        // Obter o status anterior para check de Vendedor Ativo de EM PRODUCAO -> Ativo
        const pAntigo = produtos.find(p => p.id === editingId);
        await updateDoc(doc(db, 'catalogo_vendas', editingId), dataToSave);

        if (pAntigo?.status === 'EM PRODUÇÃO' && dataToSave.status === 'ATIVO') {
          // Dispara o Vendedor Ativo
          fetch('/api/reengajamento', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              produtoId: editingId,
              nomeProduto: dataToSave.nome,
              linkCheckout: dataToSave.checkout
            })
          }).then(res => res.json())
            .then(data => console.log('Reengajamento ativo:', data))
            .catch(err => console.error('Falha no reengajamento:', err));
        }

      } else {
        await addDoc(collection(db, 'catalogo_vendas'), dataToSave);
      }
      setIsAdding(false);
      setEditingId(null);
      setForm({nome:'', modalidade:'ONLINE', categoria_online: 'CURSO_ONLINE', status:'ATIVO', pitch:'', url:'', checkout:''});
      carregarCatalogo();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto flex flex-col h-full overflow-y-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Catálogo de Vendas</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Gerencie os produtos, links e pitches da Inteligência Artificial</p>
        </div>
        <button 
          onClick={() => {setIsAdding(true); setEditingId(null); setForm({nome:'', modalidade:'ONLINE', categoria_online: 'CURSO_ONLINE', status:'ATIVO', pitch:'', url:'', checkout:''})}}
          className="bg-indigo-600 text-white px-5 py-3 rounded-xl font-bold text-sm tracking-wide flex items-center gap-2 hover:bg-indigo-700 transition"
        >
          <Plus size={16} /> Novo Produto
        </button>
      </div>

      {(isAdding || editingId) && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8">
          <h2 className="text-lg font-bold text-slate-800 mb-4">{editingId ? 'Editar Produto' : 'Novo Produto'}</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome do Produto</label>
              <input value={form.nome} onChange={e=>setForm({...form, nome: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm" placeholder="Ex: PC AC - PROTOCOLO INSANUS"/>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Modalidade</label>
              <select value={form.modalidade} onChange={e=>{
                  const v = e.target.value as 'ONLINE' | 'PRESENCIAL';
                  setForm({...form, modalidade: v, categoria_online: v === 'ONLINE' ? 'CURSO_ONLINE' : undefined, localidade_presencial: v === 'PRESENCIAL' ? 'RIO_BRANCO' : undefined });
                }} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm">
                <option value="ONLINE">Online</option>
                <option value="PRESENCIAL">Presencial</option>
              </select>
            </div>
            {form.modalidade === 'ONLINE' ? (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Categoria (Online)</label>
                <select value={form.categoria_online} onChange={e=>setForm({...form, categoria_online: e.target.value as any})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm">
                  <option value="MENTORIA">Mentoria</option>
                  <option value="CURSO_ONLINE">Curso Online</option>
                  <option value="SIMULADO">Simulado</option>
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Localidade (Presencial)</label>
                <select value={form.localidade_presencial} onChange={e=>setForm({...form, localidade_presencial: e.target.value as any})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm">
                  <option value="RIO_BRANCO">INSANUS CONCURSOS - Rio Branco/AC</option>
                  <option value="PORTO_VELHO">GABARITO CONCURSOS - Porto Velho/RO</option>
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status Comercial</label>
              <select value={form.status} onChange={e=>setForm({...form, status: e.target.value as any})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm">
                <option value="ATIVO">Ativo</option>
                <option value="EM PRODUÇÃO">Em Produção</option>
                <option value="EXPIRADO">Expirado</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Página de Vendas (Semântica IA)</label>
              <input value={form.url} onChange={e=>setForm({...form, url: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm" placeholder="https://..."/>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Link Checkout Principal</label>
              <input value={form.checkout} onChange={e=>setForm({...form, checkout: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm" placeholder="Pagar.me / Hotmart"/>
            </div>

            {form.modalidade === 'PRESENCIAL' && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data de Início da Turma</label>
                  <input value={form.data_inicio || ''} onChange={e=>setForm({...form, data_inicio: e.target.value})} type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm" placeholder="Ex: 08/06/2026"/>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Qtd. de Encontros (Aulas)</label>
                  <input value={form.quantidade_encontros || ''} onChange={e=>setForm({...form, quantidade_encontros: e.target.value})} type="number" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm" placeholder="Ex: 60"/>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Valor de Ancoragem (R$)</label>
                  <input value={form.valor_ancoragem || ''} onChange={e=>setForm({...form, valor_ancoragem: e.target.value})} type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm" placeholder="Ex: 1.200,00"/>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Desconto Crédito</label>
                    <input value={form.valor_desconto_credito || ''} onChange={e=>setForm({...form, valor_desconto_credito: e.target.value})} type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm" placeholder="Ex: 900,00"/>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Desconto PIX</label>
                    <input value={form.valor_desconto_pix || ''} onChange={e=>setForm({...form, valor_desconto_pix: e.target.value})} type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm" placeholder="Ex: 850,00"/>
                  </div>
                </div>
              </>
            )}

            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Pitch de Vendas (Resumo IA)</label>
              <textarea value={form.pitch} onChange={e=>setForm({...form, pitch: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm min-h-[100px]" placeholder="Argumento de vendas que a IA usará..."/>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={()=>{setIsAdding(false); setEditingId(null)}} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-xl text-sm font-bold">Cancelar</button>
            <button onClick={handlesave} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold flex items-center gap-2"><Check size={16}/> Salvar Produto</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center p-12 text-slate-400 font-bold">Carregando...</div>
      ) : (
        <div className="space-y-12">
          {produtos.length === 0 && !isAdding && (
             <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-3xl">
               <p className="text-slate-400 font-bold">Nenhum produto cadastrado no catálogo.</p>
             </div>
          )}

          {/* SESSÃO 1: PRODUTOS ONLINE */}
          {produtos.filter(p => p.modalidade === 'ONLINE').length > 0 && (
            <div>
              <h2 className="text-xl font-black text-slate-800 mb-6 uppercase tracking-widest border-b-2 border-indigo-100 pb-2">🌐 Produtos Online</h2>
              
              <div className="space-y-8">
                {['MENTORIA', 'CURSO_ONLINE', 'SIMULADO'].map(categoria => {
                  const items = produtos.filter(p => p.modalidade === 'ONLINE' && p.categoria_online === categoria);
                  if (items.length === 0) return null;
                  
                  // Sort by status
                  const order = { 'ATIVO': 1, 'EM PRODUÇÃO': 2, 'EXPIRADO': 3 };
                  items.sort((a, b) => order[a.status] - order[b.status]);

                  const getCategoriaName = (c: string) => {
                    if (c === 'MENTORIA') return 'Mentorias';
                    if (c === 'CURSO_ONLINE') return 'Cursos Online';
                    return 'Simulados';
                  };

                  return (
                    <div key={categoria}>
                      <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 bg-slate-100 inline-block px-3 py-1 rounded-lg">{getCategoriaName(categoria)}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {items.map(p => <ProductCard key={p.id} p={p} onEdit={(prod) => { setEditingId(prod.id); setForm(prod); setIsAdding(false); }} />)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SESSÃO 2: PRODUTOS PRESENCIAIS */}
          {produtos.filter(p => p.modalidade === 'PRESENCIAL').length > 0 && (
            <div>
              <h2 className="text-xl font-black text-slate-800 mb-6 uppercase tracking-widest border-b-2 border-indigo-100 pb-2 mt-8">🏢 Produtos Presenciais</h2>
              
              <div className="space-y-8">
                {['RIO_BRANCO', 'PORTO_VELHO'].map(localidade => {
                  const items = produtos.filter(p => p.modalidade === 'PRESENCIAL' && p.localidade_presencial === localidade);
                  if (items.length === 0) return null;

                  const order = { 'ATIVO': 1, 'EM PRODUÇÃO': 2, 'EXPIRADO': 3 };
                  items.sort((a, b) => order[a.status] - order[b.status]);

                  const getLocalidadeName = (l: string) => {
                    if (l === 'RIO_BRANCO') return 'INSANUS CONCURSOS - Rio Branco/AC';
                    return 'GABARITO CONCURSOS - Porto Velho/RO';
                  };

                  return (
                    <div key={localidade}>
                      <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 bg-slate-100 inline-block px-3 py-1 rounded-lg">{getLocalidadeName(localidade)}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {items.map(p => <ProductCard key={p.id} p={p} onEdit={(prod) => { setEditingId(prod.id); setForm(prod); setIsAdding(false); }} />)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

function ProductCard({ p, onEdit }: { p: ProdutoCatalogo, onEdit: (p: ProdutoCatalogo) => void, key?: any }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col relative group">
      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition">
        <button onClick={() => onEdit(p)} className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-indigo-100 hover:text-indigo-600">
          <Edit2 size={14} />
        </button>
      </div>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500">
          <ShoppingBag size={20} />
        </div>
        <div>
          <h3 className="font-black text-slate-800 leading-tight pr-8">{p.nome}</h3>
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            {p.modalidade === 'ONLINE' ? p.categoria_online?.replace('_', ' ') || 'ONLINE' : p.localidade_presencial?.replace('_', ' ') || 'PRESENCIAL'}
          </p>
        </div>
      </div>
      
      <div className="mb-4 flex items-center">
        <span className={`px-2 py-1 text-[10px] font-black uppercase rounded-md tracking-wider ${
          p.status === 'ATIVO' ? 'bg-emerald-100 text-emerald-700' : 
          p.status === 'EM PRODUÇÃO' ? 'bg-amber-100 text-amber-700' : 
          'bg-rose-100 text-rose-700'
        }`}>
          {p.status}
        </span>
      </div>

      <div className="text-sm text-slate-600 line-clamp-3 mb-4 flex-1">
        {p.pitch || "Sem pitch cadastrado."}
      </div>

      {(p.url || p.checkout) && (
        <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 mt-auto">
          {p.url && <a href={p.url} target="_blank" rel="noreferrer" className="text-xs font-bold text-indigo-600 hover:text-indigo-800 truncate">Pág. Vendas: {p.url}</a>}
          {p.checkout && <a href={p.checkout} target="_blank" rel="noreferrer" className="text-xs font-bold text-indigo-600 hover:text-indigo-800 truncate">Checkout: {p.checkout}</a>}
        </div>
      )}
    </div>
  );
}
