// src/theme/IconeDept.jsx
// Ícone de cada departamento.
import { Music, Camera, Baby, Shield, Coffee, HandHeart, LayoutGrid } from 'lucide-react'
import { slugDept } from './deptCores'

const ICONES = {
  louvor: Music,
  midia: Camera,
  infantil: Baby,
  diaconia: Shield,
  cantina: Coffee,
  ministros: HandHeart,
  outro: LayoutGrid,
}

export default function IconeDept({ nome, className = 'w-5 h-5' }) {
  const Icone = ICONES[slugDept(nome)]
  return <Icone className={className} aria-hidden="true" />
}
