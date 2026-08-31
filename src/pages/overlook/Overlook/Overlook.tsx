import { useEffect } from "react"

export default function Overlook() {

  useEffect(() => {
    console.log('Overlook mounted')
    return () => {
      console.log('Overlook unmounted')
    }
  }, [])

  return <div>
    <h1>调度监控</h1>
  </div>
}
