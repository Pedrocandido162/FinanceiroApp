import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '../api.js';

export default function Login() {
  const [modo, setModo] = useState('login');
  const [form, setForm] = useState({ nome: '', email: '', senha: '' });
  const [erro, setErro] = useState('');
  const nav = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setErro('');
    try {
      const data = await api(`/auth/${modo === 'login' ? 'login' : 'registro'}`, { method: 'POST', body: form });
      setToken(data.token);
      localStorage.setItem('fin_user', JSON.stringify(data.usuario));
      nav('/');
    } catch (err) { setErro(err.message); }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1 style={{ marginTop: 0 }}>💰 Meu Financeiro</h1>
        <p className="muted">{modo === 'login' ? 'Entre para gerenciar suas finanças.' : 'Crie sua conta. O primeiro usuário vira administrador.'}</p>
        {erro && <div className="erro">{erro}</div>}
        <form onSubmit={submit}>
          {modo === 'registro' && (
            <input placeholder="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
          )}
          <input type="email" placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <input type="password" placeholder="Senha (mín. 6 caracteres)" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} required minLength={6} />
          <button className="solid" type="submit">{modo === 'login' ? 'Entrar' : 'Cadastrar'}</button>
        </form>
        <p className="muted" style={{ marginBottom: 0 }}>
          {modo === 'login' ? <>Sem conta? <a href="#" onClick={(e) => { e.preventDefault(); setModo('registro'); }}>Cadastre-se</a></> : <>Já tem conta? <a href="#" onClick={(e) => { e.preventDefault(); setModo('login'); }}>Entre</a></>}
        </p>
      </div>
    </div>
  );
}
