import { Link, Outlet } from 'react-router-dom';

export function Layout() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <h1>Мини-приложение RPG-персонажей</h1>
        <nav>
          <Link to="/">Персонажи</Link>
          <Link to="/monsters">Монстры</Link>
          <Link to="/create">Создать</Link>
          <Link to="/sessions">Сессии</Link>
        </nav>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
