import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase, supabaseConfigWarning } from './supabaseClient'
import './Game.css'

const MENU = [
  { id: 'burger', name: 'Little burger', detail: 'Cheesy, juicy, just right', price: 6, icon: '🍔', type: 'Meals' },
  { id: 'sandwich', name: 'Grilled cheese', detail: 'Golden and melty', price: 5, icon: '🥪', type: 'Meals' },
  { id: 'pizza', name: 'Pizza slice', detail: 'Extra cheese, please', price: 4, icon: '🍕', type: 'Meals' },
  { id: 'nuggets', name: 'Chicken nuggets', detail: 'Crispy little bites', price: 5, icon: '🍗', type: 'Meals' },
  { id: 'mac', name: 'Mac & cheese', detail: 'A cozy favorite', price: 5, icon: '🧀', type: 'Meals' },
  { id: 'wrap', name: 'Salad wrap', detail: 'Crunchy and fresh', price: 5, icon: '🌯', type: 'Meals' },
  { id: 'fries', name: 'Crispy fries', detail: 'A little salty, a lot yummy', price: 3, icon: '🍟', type: 'Sides' },
  { id: 'hash-browns', name: 'Hash browns', detail: 'Golden and crispy', price: 3, icon: '🥔', type: 'Sides' },
  { id: 'apple', name: 'Apple slices', detail: 'Sweet and crunchy', price: 2, icon: '🍎', type: 'Sides' },
  { id: 'lemonade', name: 'Fresh lemonade', detail: 'Sunshine in a cup', price: 2, icon: '🍋', type: 'Drinks' },
  { id: 'cappuccino', name: 'Cappuccino', detail: 'Foamy and cozy', price: 3, icon: '☕', type: 'Drinks' },
  { id: 'shake', name: 'Strawberry shake', detail: 'Cool, creamy, dreamy', price: 4, icon: '🥤', type: 'Drinks' },
  { id: 'juice', name: 'Orange juice', detail: 'A bright morning sip', price: 2, icon: '🧃', type: 'Drinks' },
  { id: 'water', name: 'Cool water', detail: 'Nice and refreshing', price: 1, icon: '💧', type: 'Drinks' },
]
const FILTERS = ['Everything', 'Meals', 'Sides', 'Drinks']
const LABELS = { new: 'New order', making: 'Cooking', ready: 'Ready!', served: 'Served' }
let audioContext

function startOrderChime() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) return
  audioContext ||= new AudioContextClass()
  if (audioContext.state === 'suspended') audioContext.resume()
  const now = audioContext.currentTime
  ;[880, 1174].forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()
    const startAt = now + index * 0.16
    oscillator.type = 'sine'
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(0.0001, startAt)
    gain.gain.exponentialRampToValueAtTime(0.16, startAt + 0.025)
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.28)
    oscillator.connect(gain)
    gain.connect(audioContext.destination)
    oscillator.start(startAt)
    oscillator.stop(startAt + 0.3)
  })
}

function savedOrders() {
  try {
    return JSON.parse(localStorage.getItem('sunny-side-orders') || '[]').map((order) => ({
      ...order,
      timeLabel: order.timeLabel || new Date(order.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    }))
  } catch { return [] }
}

function mapOrder(row) {
  return {
    id: row.id, customer: row.customer_name, items: row.items, total: row.total,
    status: row.status, createdAt: row.created_at,
    timeLabel: new Date(row.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
  }
}

function upsertOrder(list, order) {
  return [order, ...list.filter((item) => item.id !== order.id)]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

function createOrder(customer, items, total) {
  const createdAt = new Date()
  return {
    id: crypto.randomUUID(), customer, items: items.map(({ id, name, quantity, price, icon }) => ({ id, name, quantity, price, icon })),
    total, status: 'new', createdAt: createdAt.toISOString(),
    timeLabel: createdAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
  }
}

function price(amount) { return `$${amount.toFixed(2)}` }

export default function Game() {
  const [side, setSide] = useState('customer')
  const [orders, setOrders] = useState(savedOrders)
  const [basket, setBasket] = useState({})
  const [filter, setFilter] = useState('Everything')
  const [name, setName] = useState('')
  const [toast, setToast] = useState('')
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('sunny-side-order-sound') === 'on')
  const [syncMessage, setSyncMessage] = useState(supabaseConfigWarning
    ? 'Shared order sync settings are invalid. The game is running on this device only.'
    : '')
  const soundEnabledRef = useRef(soundEnabled)
  const sideRef = useRef(side)

  useEffect(() => { soundEnabledRef.current = soundEnabled }, [soundEnabled])
  useEffect(() => { sideRef.current = side }, [side])

  useEffect(() => { localStorage.setItem('sunny-side-orders', JSON.stringify(orders)) }, [orders])

  useEffect(() => {
    if (!supabase) return undefined
    let mounted = true
    supabase.from('orders').select('*').order('created_at', { ascending: false }).then(({ data, error }) => {
      if (!mounted) return
      if (error) setSyncMessage('Could not load the shared kitchen. Check the Supabase setup.')
      else setOrders((current) => data.reduce((list, row) => upsertOrder(list, mapOrder(row)), current))
    })
    const channel = supabase.channel('sunny-side-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, ({ eventType, new: row, old }) => {
        if (eventType === 'DELETE') setOrders((current) => current.filter((order) => order.id !== old.id))
        else {
          if (eventType === 'INSERT' && soundEnabledRef.current && sideRef.current === 'store') startOrderChime()
          setOrders((current) => upsertOrder(current, mapOrder(row)))
        }
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') setSyncMessage('Live updates paused. Check your connection.')
        if (status === 'SUBSCRIBED') setSyncMessage('')
      })
    return () => { mounted = false; supabase.removeChannel(channel) }
  }, [])

  const items = useMemo(() => MENU.filter((item) => basket[item.id]).map((item) => ({ ...item, quantity: basket[item.id] })), [basket])
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const count = items.reduce((sum, item) => sum + item.quantity, 0)
  const openOrders = orders.filter((order) => order.status !== 'served')
  const served = orders.filter((order) => order.status === 'served')
  const menu = filter === 'Everything' ? MENU : MENU.filter((item) => item.type === filter)

  function changeBasket(id, delta) {
    setBasket((current) => {
      const next = { ...current }
      const quantity = (next[id] || 0) + delta
      if (quantity <= 0) delete next[id]
      else next[id] = quantity
      return next
    })
  }

  function toggleOrderSound() {
    const next = !soundEnabled
    if (next) startOrderChime()
    setSoundEnabled(next)
    localStorage.setItem('sunny-side-order-sound', next ? 'on' : 'off')
  }

  async function sendOrder(event) {
    event.preventDefault()
    if (!items.length) return
    const order = createOrder(name.trim() || 'Happy customer', items, total)
    if (supabase) {
      const { data, error } = await supabase.from('orders').insert({
        id: order.id, customer_name: order.customer, items: order.items, total, status: 'new',
      }).select().single()
      if (error) { setSyncMessage('Order did not send. Check the Supabase setup and try again.'); return }
      setOrders((current) => upsertOrder(current, mapOrder(data)))
    } else setOrders((current) => upsertOrder(current, order))
    setBasket({}); setName(''); setToast('Order sent to the kitchen!')
    window.setTimeout(() => setToast(''), 2600)
  }

  async function advance(order) {
    const status = { new: 'making', making: 'ready', ready: 'served' }[order.status]
    if (!status) return
    if (supabase) {
      const { error } = await supabase.from('orders').update({ status }).eq('id', order.id)
      if (error) { setSyncMessage('That update did not save. Check the Supabase setup and try again.'); return }
    }
    setOrders((current) => current.map((item) => item.id === order.id ? { ...item, status } : item))
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="Sunny Side Cafe home"><span className="brand-sun">☀</span><span><strong>Sunny Side</strong><small>PRETEND CAFE</small></span></a>
        <nav className="side-switch" aria-label="Choose a side">
          <button className={side === 'customer' ? 'chosen' : ''} aria-pressed={side === 'customer'} onClick={() => setSide('customer')}><span>🛍️</span> Customer</button>
          <button className={side === 'store' ? 'chosen' : ''} aria-pressed={side === 'store'} onClick={() => setSide('store')}><span>👩‍🍳</span> Store{openOrders.length > 0 && <b>{openOrders.length}</b>}</button>
        </nav>
        <div className={`live-indicator ${supabase ? 'live' : ''}`}><i />{supabase ? 'Live order board' : 'Ready to play'}</div>
      </header>

      {syncMessage && <div className="sync-message" role="status">{syncMessage}</div>}

      {side === 'customer' ? <>
        <section className="intro customer-intro" id="home">
          <div><p className="eyebrow">✳ &nbsp;OPEN FOR IMAGINARY BUSINESS</p><h1>What sounds<br className="phone-only" /> <em>good</em> today?</h1><p className="intro-copy">Take a little look at our menu. The kitchen is ready when you are.</p></div>
          <div className="hero-food" aria-hidden="true"><span className="hero-spark">✳</span><span className="hero-plate">🥞</span><span className="hero-dot">●</span></div>
        </section>
        <div className="customer-layout">
          <section className="menu-area" aria-label="Cafe menu">
            <div className="section-heading"><div><span className="kicker">MADE WITH A LITTLE MAGIC</span><h2>The menu</h2></div><span className="kitchen-open"><i /> Kitchen is open</span></div>
            <div className="filter-row" aria-label="Filter menu">{FILTERS.map((item) => <button key={item} className={filter === item ? 'filter-active' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div>
            <div className="menu-grid">{menu.map((item) => <article className="menu-item" key={item.id}>
              <div className={`food-picture picture-${item.id}`} aria-hidden="true">{item.icon}</div>
              <div className="menu-copy"><span className="food-type">{item.type}</span><h3>{item.name}</h3><p>{item.detail}</p></div>
              <div className="menu-bottom"><strong>{price(item.price)}</strong><button className="add-item" onClick={() => changeBasket(item.id, 1)} aria-label={`Add ${item.name}`}><span>+</span><b>Add</b></button></div>
              {basket[item.id] > 0 && <span className="in-basket">{basket[item.id]} in order</span>}
            </article>)}</div>
          </section>

          <aside className="receipt" aria-label="Your order">
            <div className="receipt-heading"><span aria-hidden="true">✳</span><div><span className="kicker">YOUR PICKUP TICKET</span><h2>Your order</h2></div></div>
            {!items.length ? <div className="empty-basket"><span>🧺</span><p>Your basket is waiting for<br />something delicious.</p></div> : <ul className="basket-list">
              {items.map((item) => <li key={item.id}><span className="basket-emoji">{item.icon}</span><span className="basket-name">{item.name}<small>{price(item.price)} each</small></span><span className="stepper"><button onClick={() => changeBasket(item.id, -1)} aria-label={`Remove one ${item.name}`}>−</button><b>{item.quantity}</b><button onClick={() => changeBasket(item.id, 1)} aria-label={`Add one ${item.name}`}>+</button></span></li>)}
            </ul>}
            <div className="receipt-total"><span>Total <small>({count} {count === 1 ? 'item' : 'items'})</small></span><strong>{price(total)}</strong></div>
            <form className="order-form" onSubmit={sendOrder}><label htmlFor="customer-name">Name for the order <small>optional</small></label><input id="customer-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Mom" maxLength={32} /><button className="send-order" type="submit" disabled={!count}>Send to the kitchen <span>↗</span></button></form>
            <p className="pretend-note">♡ &nbsp;No real money, just make-believe.</p>
          </aside>
        </div>
      </> : <section className="store-area">
        <div className="intro store-intro"><div><p className="eyebrow">✳ &nbsp;SUNNY SIDE KITCHEN</p><h1>Order <em>up.</em></h1><p className="intro-copy">Make something wonderful. Your customers are hungry!</p></div><div className="ticket-stack"><span>ORDERS</span><strong>{String(openOrders.length).padStart(2, '0')}</strong><small>IN THE KITCHEN</small></div></div>
        <div className="queue-heading"><div><span className="kicker">THE PASS</span><h2>Kitchen tickets <b>{openOrders.length}</b></h2></div><div className="queue-tools"><div className="status-key"><span>New</span><span>Cooking</span><span>Ready</span></div><button className={`sound-toggle ${soundEnabled ? 'sound-on' : ''}`} type="button" aria-pressed={soundEnabled} onClick={toggleOrderSound}><span aria-hidden="true">{soundEnabled ? '🔔' : '🔕'}</span>{soundEnabled ? 'Sound on' : 'Enable sound'}</button></div></div>
        {!openOrders.length ? <div className="empty-kitchen"><span>🍳</span><h3>All caught up!</h3><p>The counter is quiet. Place an order on the customer side to get cooking.</p><button onClick={() => setSide('customer')}>Go to customer side <span>↗</span></button></div> : <div className="orders-grid">{openOrders.map((order) => <article className={`kitchen-ticket ticket-${order.status}`} key={order.id}>
          <div className="ticket-head"><div><span className="ticket-number">TICKET {order.id.slice(0, 4).toUpperCase()}</span><h3>{order.customer}</h3></div><span className={`status-chip chip-${order.status}`}><i />{LABELS[order.status]}</span></div>
          <p className="ticket-time">{order.timeLabel}</p>
          <ul className="ticket-items">{order.items.map((item) => <li key={item.id}><span>{item.icon} &nbsp;{item.name}</span><b>× {item.quantity}</b></li>)}</ul>
          <div className="ticket-foot"><span>Total <b>{price(order.total)}</b></span><button onClick={() => advance(order)}>{order.status === 'new' ? 'Start cooking' : order.status === 'making' ? 'Mark ready' : 'Hand it over'} <span>→</span></button></div>
        </article>)}</div>}
        {served.length > 0 && <details className="served-orders"><summary>Recently served <span>{served.length}</span></summary><div>{served.slice(0, 6).map((order) => <p key={order.id}><b>✓ &nbsp;{order.customer}</b><span>{order.items.reduce((sum, item) => sum + item.quantity, 0)} items · {price(order.total)}</span></p>)}</div></details>}
      </section>}

      <footer className="footer"><span>Sunny Side Café ☀</span><span>Made for the joy of make-believe.</span></footer>
      {toast && <div className="toast" role="status">✓ &nbsp;{toast}</div>}
    </main>
  )
}