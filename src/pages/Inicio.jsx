import { useState, useEffect } from 'react'
import { useMsal } from '@azure/msal-react'
import { loginRequest } from '../authConfig'
import { getProyectos } from '../services/graphService'

export default function Inicio({ role, roleId, onSeleccionarProyecto }) {
  const { instance, accounts } = useMsal()
  const [proyectos, setProyectos] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    async function cargar() {
      try {
        const todos = await getProyectos(instance, accounts, loginRequest)

        if (role === 'admin') {
          setProyectos(todos)
        } else if (role === 'rl') {
          setProyectos(todos.filter(p => p.ID_RL === roleId))
        } else if (role === 'rm') {
          setProyectos(todos.filter(p => p.ID_RM === roleId))
        }
      } catch (e) {
        console.error('Error cargando proyectos:', e)
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [role, roleId])

  const visibles = proyectos.filter(p =>
    p.field_1?.toLowerCase().includes(busqueda.toLowerCase())
  )

  if (loading) return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', color: '#666' }}>
      Cargando proyectos...
    </div>
  )

  return (
    <div style={{ padding: '32px', fontFamily: 'sans-serif', width: '100%' , minWidth: '100vh', boxSizing: 'border-box' }}>
      <h2 style={{ fontSize: '20px', fontWeight: '500', marginBottom: '16px', color: '#1a1a1a' }}>
        Seleccioná un proyecto
      </h2>
      <input
        style={{ width: '100%', maxWidth: '360px', padding: '8px 14px', fontSize: '14px', border: '1px solid #e5e5e5', borderRadius: '8px', marginBottom: '24px', outline: 'none', boxSizing: 'border-box' }}
        placeholder="Buscar proyecto..."
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
        {visibles.map(p => (
          <div
            key={p.id}
            style={{ padding: '20px', border: '1px solid #e5e5e5', borderRadius: '10px', cursor: 'pointer', background: '#fff', transition: 'border-color 0.15s' }}
            onClick={() => onSeleccionarProyecto(p)}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#378ADD'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#e5e5e5'}
          >
            <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '6px' }}>#{p.id}</div>
            <div style={{ fontSize: '15px', fontWeight: '500', color: '#1a1a1a', marginBottom: '12px' }}>{p.field_1}</div>
            <div style={{ fontSize: '12px', color: '#378ADD' }}>Ver asignaciones →</div>
          </div>
        ))}
        {visibles.length === 0 && !loading && (
          <div style={{ color: '#aaa', fontSize: '14px', gridColumn: '1/-1' }}>
            No se encontraron proyectos.
          </div>
        )}
      </div>
    </div>
  )
  console.log('Campos del proyecto:', Object.keys(todos[0]))
}