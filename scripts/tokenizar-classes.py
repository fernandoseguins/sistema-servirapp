"""Troca classes de cor fixas do Tailwind (cinzas, branco, vermelho, verde, âmbar, azul de foco)
pelos tokens do tema Vibrante, para a tela funcionar no claro e no escuro.

Uso: python scripts/tokenizar-classes.py src/components/NoticeBoard.jsx [outros arquivos...]
Revise o diff depois: cores de identidade (ex.: gradientes de departamento) ficam como estão.
"""
import re
import sys

MAPA = [
    # superfícies
    (r'\bbg-white\b', 'bg-surface'),
    (r'\bbg-gray-(50|100)\b', 'bg-surface-2'),
    (r'\bhover:bg-gray-(50|100)\b', 'hover:bg-surface-2'),
    (r'\bbg-gray-200\b', 'bg-line'),
    (r'\bhover:bg-gray-200\b', 'hover:bg-line'),
    # bordas
    (r'\bborder-gray-(50|100|200)\b', 'border-line'),
    (r'\bborder-gray-300\b', 'border-line'),
    # texto
    (r'\btext-gray-(900|800)\b', 'text-ink'),
    (r'\btext-gray-(700|600|500)\b', 'text-ink-2'),
    (r'\btext-gray-(400|300)\b', 'text-muted'),
    (r'\bhover:text-gray-(900|800|700|600)\b', 'hover:text-ink'),
    (r'\bplaceholder-gray-400\b', 'placeholder:text-muted'),
    # estados
    (r'\bbg-red-50\b', 'bg-danger-soft'),
    (r'\bhover:bg-red-50\b', 'hover:bg-danger-soft'),
    (r'\btext-red-(700|600|500)\b', 'text-danger'),
    (r'\bhover:text-red-(700|600|500)\b', 'hover:text-danger'),
    (r'\bborder-red-(100|200|300|400|500)\b', 'border-danger'),
    (r'\bbg-green-50\b', 'bg-success-soft'),
    (r'\btext-green-(700|600)\b', 'text-success'),
    (r'\bborder-green-(100|200)\b', 'border-success'),
    (r'\bbg-(amber|yellow)-50\b', 'bg-warning-soft'),
    (r'\btext-(amber|yellow)-(700|600)\b', 'text-warning'),
    # foco
    (r'\bfocus:ring-(blue|gray)-(500|900)\b', 'focus:ring-brand'),
    # azul / roxo / índigo de ação → cor da marca
    (r'\bhover:bg-(blue|indigo|purple)-(700|800)\b', 'hover:opacity-90'),
    (r'\bbg-(blue|indigo|purple)-(500|600|700)\b', 'bg-brand'),
    (r'\bbg-(blue|indigo|purple)-(50|100)\b', 'bg-brand/10'),
    (r'\bhover:bg-(blue|indigo|purple)-(50|100)\b', 'hover:bg-brand/10'),
    (r'\btext-(blue|indigo|purple)-(500|600|700|800|900)\b', 'text-brand'),
    (r'\bhover:text-(blue|indigo|purple)-(600|700|800)\b', 'hover:text-brand'),
    (r'\bborder-(blue|indigo|purple)-(100|200|300)\b', 'border-brand/30'),
    (r'\bborder-(blue|indigo|purple)-(400|500|600)\b', 'border-brand'),
    # estados (tons restantes)
    (r'\bbg-red-100\b', 'bg-danger-soft'),
    (r'\btext-red-(800|900)\b', 'text-danger'),
    (r'\bbg-red-(500|600)\b', 'bg-danger'),
    (r'\bbg-(green|emerald)-(100)\b', 'bg-success-soft'),
    (r'\bbg-(green|emerald)-(500|600)\b', 'bg-success'),
    (r'\bhover:bg-(green|emerald)-(600|700)\b', 'hover:opacity-90'),
    (r'\btext-(green|emerald)-(500|800|900)\b', 'text-success'),
    (r'\bborder-(green|emerald)-(300|400|500)\b', 'border-success'),
    (r'\bbg-(yellow|amber|orange)-(100)\b', 'bg-warning-soft'),
    (r'\btext-(yellow|amber|orange)-(500|800|900)\b', 'text-warning'),
    (r'\btext-orange-(600|700)\b', 'text-warning'),
    (r'\bborder-(yellow|amber|orange)-(100|200|300)\b', 'border-warning/40'),
]


def tokenizar(texto):
    for padrao, novo in MAPA:
        texto = re.sub(padrao, novo, texto)
    return texto


if __name__ == '__main__':
    for caminho in sys.argv[1:]:
        with open(caminho, encoding='utf-8') as f:
            original = f.read()
        novo = tokenizar(original)
        if novo != original:
            with open(caminho, 'w', encoding='utf-8') as f:
                f.write(novo)
            print(f'alterado: {caminho}')
        else:
            print(f'sem mudanças: {caminho}')
