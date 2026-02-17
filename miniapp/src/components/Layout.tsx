import { Link, Outlet } from 'react-router-dom';

export function Layout() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <h1>RPG Character Mini App</h1>
        <nav>
          <Link to="/">Characters</Link>
          <Link to="/create">Create</Link>
          <Link to="/sessions">Sessions</Link>
        </nav>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
