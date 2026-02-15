import { promises as fs } from 'node:fs'
import path from 'node:path'

export type PersonTitle = 'Assistant' | 'Lecturer' | 'AssociateProfessor' | 'Professor' | 'Other'

export type Person = {
  personId: string
  personName: string
  departmentName: string
  title: PersonTitle
  status?: 'Active' | 'Inactive'
}

type DbShape = {
  persons: Person[]
}

const DB_FILE = path.resolve(process.cwd(), 'server', 'data', 'persons.json')

async function ensureDbFile() {
  await fs.mkdir(path.dirname(DB_FILE), { recursive: true })
  try {
    await fs.access(DB_FILE)
  } catch {
    const init: DbShape = {
      persons: [
        { personId: 'T-1001', personName: '王老师', departmentName: '机械工程学院', title: 'AssociateProfessor', status: 'Active' },
        { personId: 'T-1002', personName: '李老师', departmentName: '机械工程学院', title: 'Lecturer', status: 'Active' },
        { personId: 'T-2001', personName: '张老师', departmentName: '计算机学院', title: 'Assistant', status: 'Active' },
      ],
    }
    await fs.writeFile(DB_FILE, JSON.stringify(init, null, 2), 'utf-8')
  }
}

export async function readPersonsDb(): Promise<DbShape> {
  await ensureDbFile()
  const raw = await fs.readFile(DB_FILE, 'utf-8')
  try {
    const parsed = JSON.parse(raw)
    return {
      persons: Array.isArray(parsed?.persons) ? parsed.persons : [],
    }
  } catch {
    return { persons: [] }
  }
}

export async function writePersonsDb(next: DbShape) {
  await ensureDbFile()
  await fs.writeFile(DB_FILE, JSON.stringify(next, null, 2), 'utf-8')
}

export async function listPersons(): Promise<Person[]> {
  const db = await readPersonsDb()
  return db.persons
}

export async function upsertPerson(person: Person): Promise<Person> {
  const db = await readPersonsDb()
  const idx = db.persons.findIndex(p => p.personId === person.personId)
  if (idx === -1) db.persons.unshift(person)
  else db.persons[idx] = { ...db.persons[idx], ...person }
  await writePersonsDb(db)
  return person
}
