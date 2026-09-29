import { Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { getToken, setToken } from './api.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Transacoes from './pages/Transacoes.jsx';
import Contas from './pages/Contas.jsx';
import Cartoes from './pages/Cartoes.jsx';
import Agenda from './pages/Agenda.jsx';
import Metas from './pages/Metas.jsx';

function Layout({ children }) {
  const nav = useNavigate();
  const usuario = JSON.parse(localStorage.getItem('fin_user') || '{}');
  const links = [
    ['/', 'Dashboard'], ['/transacoes', 'Receitas e despesas'], ['/contas', 'Contas'],
    ['/cartoes', 'Cartões'], ['/agenda', 'A pagar / receber'], ['/metas', 'Metas'],
  ];
  return (
    <>
      <div className="topbar">
        <div className="logo">💰 Meu Financeiro</div>
        <nav>{links.map(([to, lbl]) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => isActive ? 'on' : ''}>{lbl}</NavLink>)}</nav>
        <div className="spacer" />
        <span className="muted">{usuario.nome}</span>
        <button onClick={() => { setToken(null); localStorage.removeItem('fin_user'); nav('/login'); }}>Sair</button>
      </div>
      <div className="page">{children}</div>
    </>
  );
}

function Private({ children }) {
  if (!getToken()) return <Navigate to="/login" />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Private><Dashboard /></Private>} />
      <Route path="/transacoes" element={<Private><Transacoes /></Private>} />
      <Route path="/contas" element={<Private><Contas /></Private>} />
      <Route path="/cartoes" element={<Private><Cartoes /></Private>} />
      <Route path="/agenda" element={<Private><Agenda /></Private>} />
      <Route path="/metas" element={<Private><Metas /></Private>} />
    </Routes>
  );
}
