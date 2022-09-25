import { performance } from 'perf_hooks'
// TODO move to test source
import type { Source as WSource } from 'wonka'

type Rec<T = any> = Record<string, T>

type UpdateLeaf = (value: number) => void

type Setup = (listener: (computedValue: number) => void) => Promise<UpdateLeaf>

// There is a few tests skipped
// coz I don't know how to turn off their batching
// which delays computations

const testComputers = setupComputersTest({
  async 'skip cellx'(listener) {
    const { cellx } = await import('cellx')

    const entry = cellx(0)
    const a = cellx(() => entry())
    const b = cellx(() => a() + 1)
    const c = cellx(() => a() + 1)
    const d = cellx(() => b() + c())
    const e = cellx(() => d() + 1)
    const f = cellx(() => d() + e())
    const g = cellx(() => d() + e())
    const h = cellx(() => f() + g())

    listener(h())

    return (i) => {
      entry(i)
      // this is wrong
      // manual pull could help to skip a computations
      // needed to notification walk
      listener(h())
    }
  },
  async effector(listener) {
    const { createEvent, createStore, combine } = await import('effector')

    const entry = createEvent<number>()
    const a = createStore(0).on(entry, (state, v) => v)
    const b = a.map((a) => a + 1)
    const c = a.map((a) => a + 1)
    const d = combine(b, c, (b, c) => b + c)
    const e = d.map((d) => d + 1)
    const f = combine(d, e, (d, e) => d + e)
    const g = combine(d, e, (d, e) => d + e)
    const h = combine(f, g, (h1, h2) => h1 + h2)

    h.subscribe(listener)

    return (i) => entry(i)
  },
  async 'effector (fork)'(listener) {
    const { createEvent, createStore, combine, allSettled, fork } =
      await import('effector')

    const entry = createEvent<number>()
    const a = createStore(0).on(entry, (state, v) => v)
    const b = a.map((a) => a + 1)
    const c = a.map((a) => a + 1)
    const d = combine(b, c, (b, c) => b + c)
    const e = d.map((d) => d + 1)
    const f = combine(d, e, (d, e) => d + e)
    const g = combine(d, e, (d, e) => d + e)
    const h = combine(f, g, (h1, h2) => h1 + h2)

    const scope = fork()

    return (i) => {
      allSettled(entry, { scope, params: i })
      // this is not wrong
      // coz effector graph a hot always
      // and `getState` is doing nothing here
      // only internal state reading
      listener(scope.getState(h))
    }
  },
  async 'skip frpts'(listener) {
    const { newAtom, combine } = await import('@frp-ts/core')

    const entry = newAtom(0)
    const a = combine(entry, (v) => v)
    const b = combine(a, (a) => a + 1)
    const c = combine(a, (a) => a + 1)
    const d = combine(b, c, (b, c) => b + c)
    const e = combine(d, (d) => d + 1)
    const f = combine(d, e, (d, e) => d + e)
    const g = combine(d, e, (d, e) => d + e)
    const h = combine(f, g, (f, g) => f + g)

    listener(h.get())

    return (i) => {
      entry.set(i)
      // this is wrong
      // manual pull could help to skip a computations
      // needed to notification walk
      listener(h.get())
    }
  },
  async mobx(listener) {
    const { makeAutoObservable, autorun, configure } = await import('mobx')

    configure({ enforceActions: 'never' })

    const proxy = makeAutoObservable({
      entry: 0,
      get a() {
        return this.entry
      },
      get b() {
        return this.a + 1
      },
      get c() {
        return this.a + 1
      },
      get d() {
        return this.b + this.c
      },
      get e() {
        return this.d + 1
      },
      get f() {
        return this.d + this.e
      },
      get g() {
        return this.d + this.e
      },
      get h() {
        return this.f + this.g
      },
    })

    autorun(() => listener(proxy.h))

    return (i) => (proxy.entry = i)
  },
  async 'skip mol'(listener) {
    const mol_wire_lib = await import('mol_wire_lib')
    const { $mol_wire_atom } = mol_wire_lib

    const entry = new $mol_wire_atom('entry', (next: number = 0) => next)
    const a = new $mol_wire_atom('mA', () => entry.sync())
    const b = new $mol_wire_atom('mB', () => a.sync() + 1)
    const c = new $mol_wire_atom('mC', () => a.sync() + 1)
    const d = new $mol_wire_atom('mD', () => b.sync() + c.sync())
    const e = new $mol_wire_atom('mE', () => d.sync() + 1)
    const f = new $mol_wire_atom('mF', () => d.sync() + e.sync())
    const g = new $mol_wire_atom('mG', () => d.sync() + e.sync())
    const h = new $mol_wire_atom('mH', () => f.sync() + g.sync())

    listener(h.sync())

    return (i) => {
      entry.put(i)
      // this is wrong
      // manual pull could help to skip a computations
      // needed to notification walk
      listener(h.sync())
    }
  },
  async preact(listener) {
    const { signal, computed, effect } = await import('@preact/signals-core')

    const entry = signal(0)
    const a = computed(() => entry.value)
    const b = computed(() => a.value + 1)
    const c = computed(() => a.value + 1)
    const d = computed(() => b.value + c.value)
    const e = computed(() => d.value + 1)
    const f = computed(() => d.value + e.value)
    const g = computed(() => d.value + e.value)
    const h = computed(() => f.value + g.value)

    effect(() => listener(h.value))

    return (i) => (entry.value = i)
  },
  async reatom(listener) {
    const { atom, createCtx } = await import('@reatom/core')
    const a = atom(0)
    const b = atom((ctx) => ctx.spy(a) + 1)
    const c = atom((ctx) => ctx.spy(a) + 1)
    const d = atom((ctx) => ctx.spy(b) + ctx.spy(c))
    const e = atom((ctx) => ctx.spy(d) + 1)
    const f = atom((ctx) => ctx.spy(d) + ctx.spy(e))
    const g = atom((ctx) => ctx.spy(d) + ctx.spy(e))
    const h = atom((ctx) => ctx.spy(f) + ctx.spy(g))

    const ctx = createCtx()
    ctx.subscribe(h, listener)

    return (i) => a(ctx, i)
  },
  async solid(listener) {
    const { createSignal, createMemo, createEffect } = await import(
      // FIXME
      // @ts-ignore
      'solid-js/dist/solid.cjs'
    )

    const [entry, update] = createSignal(0)
    const a = createMemo(() => entry())
    const b = createMemo(() => a() + 1)
    const c = createMemo(() => a() + 1)
    const d = createMemo(() => b() + c())
    const e = createMemo(() => d() + 1)
    const f = createMemo(() => d() + e())
    const g = createMemo(() => d() + e())
    const h = createMemo(() => f() + g())

    createEffect(() => listener(h()))

    return (i) => update(i)
  },
  async 's.js'(listener) {
    const { default: S } = await import('s-js')

    const { entry, h } = S.root(() => {
      const entry = S.data(0)
      const a = S(() => entry())
      const b = S(() => a() + 1)
      const c = S(() => a() + 1)
      const d = S(() => b() + c())
      const e = S(() => d() + 1)
      const f = S(() => d() + e())
      const g = S(() => d() + e())
      const h = S(() => f() + g())

      return { entry, h }
    })

    S(() => listener(h()))

    return (i) => entry(i)
  },
  async usignal(listener) {
    const { signal, computed, effect } = await import('usignal')

    const entry = signal(0)
    const a = computed(() => entry.value)
    const b = computed(() => a.value + 1)
    const c = computed(() => a.value + 1)
    const d = computed(() => b.value + c.value)
    const e = computed(() => d.value + 1)
    const f = computed(() => d.value + e.value)
    const g = computed(() => d.value + e.value)
    const h = computed(() => f.value + g.value)

    effect(() => listener(h.value))

    return (i) => (entry.value = i)
  },
  async wonka(listener) {
    const { makeSubject, pipe, map, subscribe, combine, sample } = await import(
      'wonka'
    )

    const ccombine = <A, B>(
      sourceA: WSource<A>,
      sourceB: WSource<B>,
    ): WSource<[A, B]> => {
      const source = combine(sourceA, sourceB)
      // return source
      return pipe(source, sample(source))
    }

    const entry = makeSubject<number>()
    const a = pipe(
      entry.source,
      map((v) => v),
    )
    const b = pipe(
      a,
      map((v) => v + 1),
    )
    const c = pipe(
      a,
      map((v) => v + 1),
    )
    const d = pipe(
      ccombine(b, c),
      map(([b, c]) => b + c),
    )
    const e = pipe(
      d,
      map((v) => v + 1),
    )
    const f = pipe(
      ccombine(d, e),
      map(([d, e]) => d + e),
    )
    const g = pipe(
      ccombine(d, e),
      map(([d, e]) => d + e),
    )
    const h = pipe(
      ccombine(f, g),
      map(([h1, h2]) => h1 + h2),
    )
    pipe(h, subscribe(listener))

    return (i) => entry.next(i)
  },
})

function setupComputersTest(tests: Rec<Setup>) {
  return async (iterations: number) => {
    const testsList: Array<{
      ref: { value: number }
      update: UpdateLeaf
      name: string
      logs: Array<number>
    }> = []

    for (const name in tests) {
      if (name.startsWith('skip')) continue
      const ref = { value: 0 }
      const update = await tests[name]!((value) => (ref.value = value))
      testsList.push({ ref, update, name, logs: [] })
    }

    let i = 0
    while (i++ < iterations) {
      for (const test of testsList) {
        const start = performance.now()
        test.update(i)
        test.logs.push(performance.now() - start)
      }

      if (new Set(testsList.map((test) => test.ref.value)).size !== 1) {
        console.log(`ERROR!`)
        console.error(`Results is not equal (iteration №${i})`)
        console.log(
          testsList.reduce(
            (acc, test) => ((acc[test.name] = test.ref.value), acc),
            {} as Rec<number>,
          ),
        )
        return
      }

      await new Promise((resolve) => setTimeout(resolve, 0))
    }

    console.log(`Median on one call in ms from ${iterations} iterations`)

    printLogs(
      testsList.reduce(
        (acc, { name, logs }) => ((acc[name] = log(logs)), acc),
        {} as Rec<any>,
      ),
    )
  }
}

test()
async function test() {
  await Promise.all([
    testComputers(10),
    testComputers(100),
    testComputers(1_000),
    testComputers(10_000),
  ])

  process.exit()
}

function printLogs(results: Rec<ReturnType<typeof log>>) {
  const medFastest = Math.min(...Object.values(results).map(({ med }) => med))

  const tabledData = Object.entries(results)
    .sort(([, { med: a }], [, { med: b }]) => a - b)
    .reduce((acc, [name, { min, med, max }]) => {
      acc[name] = {
        'pos %': ((medFastest / med) * 100).toFixed(0),
        'avg ms': med.toFixed(3),
        'min ms': min.toFixed(5),
        'med ms': med.toFixed(5),
        'max ms': max.toFixed(5),
      }
      return acc
    }, {} as Rec<Rec>)

  console.table(tabledData)
}

function formatPercent(n = 0) {
  return `${n < 1 ? ` ` : ``}${(n * 100).toFixed(0)}%`
}

function log(values: Array<number>) {
  return {
    min: min(values),
    med: med(values),
    max: max(values),
  }
}

function med(values: Array<number>) {
  if (values.length === 0) return 0

  values = values.map((v) => +v)

  values.sort((a, b) => (a - b < 0 ? 1 : -1))

  var half = Math.floor(values.length / 2)

  if (values.length % 2) return values[half]!

  return (values[half - 1]! + values[half]!) / 2.0
}

function min(values: Array<number>) {
  if (values.length === 0) return 0

  values = values.map((v) => +v)

  values.sort((a, b) => (a - b < 0 ? -1 : 1))

  const limit = Math.floor(values.length / 20)

  return values[limit]!
}

function max(values: Array<number>) {
  if (values.length === 0) return 0

  values = values.map((v) => +v)

  values.sort((a, b) => (a - b < 0 ? -1 : 1))

  const limit = values.length - 1 - Math.floor(values.length / 20)

  return values[limit]!
}
