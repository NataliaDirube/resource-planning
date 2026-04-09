import { useState, useEffect } from 'react'
import { getDeliveryManagers, getOperationalManagers } from '../services/graphService'
import { loginRequest } from '../authConfig'

const ADMINS = ['natalia.dirube@go-scm.com', 'diego.oliva@go-scm.com', 'francisco.dupou@go-scm.com'] // reemplazá con los emails de los admins

export function useRole(instance, accounts) {
  const [role, setRole] = useState(null)
  const [roleId, setRoleId] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!accounts || accounts.length === 0) return

    const email = accounts[0].username.toLowerCase()

    async function detectRole() {

      // TEMPORAL: forzar rol para testear — borrá esta línea cuando termines
      // setRole('rl'); setRoleId(1); setLoading(false); return
      // setRole('rm'); setRoleId(1); setLoading(false); return
      // setRole('admin'); setLoading(false); return

      try {
        if (ADMINS.includes(email)) {
          setRole('admin')
          setLoading(false)
          return
        }

        const oms = await getOperationalManagers(instance, accounts, loginRequest)
        const om = oms.find(o => o.OperationalManager?.Email?.toLowerCase() === email)
        if (om) {
          setRole('rm')
          setRoleId(om.ID)
          setLoading(false)
          return
        }

        const dms = await getDeliveryManagers(instance, accounts, loginRequest)
        const dm = dms.find(d => d.DeliveryManager?.Email?.toLowerCase() === email)
        if (dm) {
          setRole('rl')
          setRoleId(dm.ID)
          setLoading(false)
          return
        }

        setRole('sin_acceso')
        setLoading(false)
      } catch (e) {
        console.error('Error detectando rol:', e)
        setRole('sin_acceso')
        setLoading(false)
      }
    }

    detectRole()
  }, [accounts])

  return { role, roleId, loading }
}   