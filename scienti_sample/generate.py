"""Generate a synthetic Scienti sample (CvLAC + GrupLAC) with realistic
relations — coauthorships within groups, line-of-research clustering,
and overlapping memberships — so the dashboard visualisations show
meaningful structure.

Run it from the repo root:

    python scienti_sample/generate.py

Output:
    scienti_sample/cvlac/<10-digit cod_rh>.json   (150 researchers)
    scienti_sample/gruplac/<14-digit nro>.json    (30 groups)

The synthetic data follows the exact schema produced by the real
scraper, so the backend's aiq.scienti loaders pick it up without any
adjustments.

No real personal data is touched; every name and affiliation is
generated deterministically from a fixed seed (so re-runs are stable).
"""

from __future__ import annotations

import json
import random
from datetime import date
from pathlib import Path

SEED = 20260513
random.seed(SEED)

ROOT = Path(__file__).resolve().parent
CVLAC_DIR = ROOT / "cvlac"
GRUPLAC_DIR = ROOT / "gruplac"

# ── Vocabulary ──────────────────────────────────────────

FIRST_NAMES_F = [
    "ANA", "MARÍA", "LUCÍA", "VALENTINA", "CAMILA", "SOFÍA", "ISABELLA",
    "DANIELA", "PAULA", "ANDREA", "CAROLINA", "DIANA", "CLAUDIA",
    "MÓNICA", "PATRICIA", "BEATRIZ", "ALEJANDRA", "JULIANA", "NATALIA",
    "MARGARITA",
]
FIRST_NAMES_M = [
    "CARLOS", "JUAN", "ANDRÉS", "DAVID", "DIEGO", "SEBASTIÁN", "MIGUEL",
    "FELIPE", "MAURICIO", "JAVIER", "JORGE", "RICARDO", "OSCAR",
    "GUSTAVO", "FERNANDO", "ALEJANDRO", "PABLO", "RODRIGO", "EDUARDO",
    "ESTEBAN",
]
LAST_NAMES = [
    "GARCÍA", "RODRÍGUEZ", "MARTÍNEZ", "LÓPEZ", "GONZÁLEZ", "PÉREZ",
    "SÁNCHEZ", "RAMÍREZ", "TORRES", "FLORES", "RIVERA", "GÓMEZ",
    "DÍAZ", "REYES", "MORALES", "CRUZ", "JIMÉNEZ", "MENDOZA",
    "CASTILLO", "VARGAS", "ROJAS", "RUIZ", "HERRERA", "MEDINA",
    "AGUILAR", "VEGA", "MORENO", "MUÑOZ", "ALVAREZ", "ORTEGA",
    "DELGADO", "CASTRO", "ROMERO", "NAVARRO", "TORRES", "PARRA",
    "ESPINOSA", "OSPINA", "VALENCIA", "MOLINA",
]

INSTITUTIONS = [
    "UNIVERSIDAD NACIONAL DE COLOMBIA",
    "UNIVERSIDAD DE LOS ANDES",
    "UNIVERSIDAD DEL VALLE",
    "UNIVERSIDAD DE ANTIOQUIA",
    "PONTIFICIA UNIVERSIDAD JAVERIANA",
    "UNIVERSIDAD INDUSTRIAL DE SANTANDER",
    "UNIVERSIDAD DEL ROSARIO",
    "UNIVERSIDAD EAFIT",
    "UNIVERSIDAD EXTERNADO DE COLOMBIA",
    "UNIVERSIDAD DEL NORTE",
]

DEPARTMENTS = ["BOGOTÁ", "MEDELLÍN", "CALI", "BUCARAMANGA", "BARRANQUILLA"]

CATEGORIES = ["", "Senior", "Asociado", "Junior"]
GROUP_CLASSIFICATIONS = ["A1", "A", "B", "C", ""]
SEXOS = ["Femenino", "Masculino"]

# Research themes. Each group is anchored on a theme; coauthors mostly
# come from groups sharing that theme.
THEMES = {
    "algebra": {
        "lines": [
            "Teoría de representaciones de álgebras",
            "Álgebras de configuración de Brauer",
            "Quivers y álgebras de caminos",
            "Categorías derivadas",
            "Álgebras de Hopf",
        ],
        "areas": [
            "Ciencias Naturales -- Matemáticas -- Matemáticas Puras",
            "Ciencias Naturales -- Matemáticas -- Álgebra",
        ],
        "paper_topics": [
            "On Brauer configuration algebras and their representations",
            "Quivers of tame representation type",
            "Cluster algebras and Auslander-Reiten theory",
            "Path algebras over finite quivers",
            "Mutation of derived equivalences",
            "Tilting modules and t-structures",
            "Gröbner basis methods for path algebras",
            "Hopf algebras associated to quivers",
        ],
    },
    "combinatoria": {
        "lines": [
            "Combinatoria algebraica",
            "Teoría de grafos",
            "Particiones de enteros",
            "Polinomios simétricos",
        ],
        "areas": [
            "Ciencias Naturales -- Matemáticas -- Combinatoria",
            "Ciencias Naturales -- Matemáticas -- Teoría de Grafos",
        ],
        "paper_topics": [
            "Generating functions for integer partitions",
            "Symmetric functions and Schur polynomials",
            "Graph colorings and chromatic polynomials",
            "Spanning trees in random graphs",
            "Tableaux and the RSK correspondence",
            "Posets and lattice paths",
        ],
    },
    "biologia": {
        "lines": [
            "Ecología de comunidades",
            "Biodiversidad neotropical",
            "Conservación de especies amenazadas",
            "Insectos sociales",
        ],
        "areas": [
            "Ciencias Naturales -- Ciencias Biológicas -- Ecología",
            "Ciencias Naturales -- Ciencias Biológicas -- Zoología",
        ],
        "paper_topics": [
            "Patrones de nidificación de abejas sin aguijón",
            "Distribución de aves migratorias en el neotrópico",
            "Conservación de la ballena jorobada en Gorgona",
            "Estructura de comunidades de hormigas urbanas",
            "Insectos polinizadores en ecosistemas alterados",
        ],
    },
    "fisica": {
        "lines": [
            "Materia condensada",
            "Física de altas energías",
            "Óptica cuántica",
            "Materiales magnéticos",
        ],
        "areas": [
            "Ciencias Naturales -- Ciencias Físicas -- Física de la Materia Condensada",
            "Ciencias Naturales -- Ciencias Físicas -- Óptica",
        ],
        "paper_topics": [
            "Magnetic ordering in frustrated lattices",
            "Quantum entanglement in photonic systems",
            "Superconducting order parameters",
            "Topological insulators and edge states",
        ],
    },
    "computacion": {
        "lines": [
            "Aprendizaje automático",
            "Grafos y redes complejas",
            "Computación científica",
            "Visión por computador",
        ],
        "areas": [
            "Ingeniería -- Ciencia de la Computación -- Inteligencia Artificial",
            "Ciencias Naturales -- Ciencia de la Computación",
        ],
        "paper_topics": [
            "Graph neural networks for molecular property prediction",
            "Deep learning on citation networks",
            "Spectral methods for community detection",
            "Convolutional architectures for image segmentation",
        ],
    },
    "humanidades": {
        "lines": [
            "Filosofía de la ciencia",
            "Historia de las matemáticas",
            "Lógica simbólica",
            "Epistemología contemporánea",
        ],
        "areas": [
            "Humanidades -- Filosofía -- Filosofía de la Ciencia",
            "Humanidades -- Historia -- Historia de las Ciencias",
        ],
        "paper_topics": [
            "On the foundations of category theory",
            "The role of analogy in mathematical discovery",
            "Wittgenstein and mathematical practice",
            "Lakatos and proofs in 19th-century geometry",
        ],
    },
}

THEME_KEYS = list(THEMES.keys())


def name(idx: int) -> str:
    """Deterministic synthetic name."""
    sex = random.choice(SEXOS)
    first = random.choice(FIRST_NAMES_F if sex == "Femenino" else FIRST_NAMES_M)
    second_first = random.choice(FIRST_NAMES_F + FIRST_NAMES_M)
    last1 = random.choice(LAST_NAMES)
    last2 = random.choice(LAST_NAMES)
    return f"{last1} {last2}, {first} {second_first}", sex


def cod_rh(idx: int) -> str:
    # 10-digit zero-padded just like real CvLAC.
    return str(10_000 + idx).zfill(10)


def nro_gruplac(idx: int) -> str:
    return str(idx + 1).zfill(14)


# ── Generate groups ─────────────────────────────────────

N_GROUPS = 30
N_RESEARCHERS = 150

groups: list[dict] = []
researcher_seed: list[tuple[str, str]] = []  # (cod_rh, full_name)

# Assign a theme to each group; the first 6 groups span the 6 themes,
# the rest are biased toward algebra/combinatoria (the project focus).
group_themes: list[str] = list(THEME_KEYS) + [
    random.choice(["algebra", "algebra", "combinatoria", "computacion", "fisica"])
    for _ in range(N_GROUPS - len(THEME_KEYS))
]
random.shuffle(group_themes)

researcher_idx = 0
for gi in range(N_GROUPS):
    theme = group_themes[gi]
    big = gi < 5
    n_members = random.randint(8, 14) if big else random.randint(2, 5)

    members = []
    for _ in range(n_members):
        if researcher_idx >= N_RESEARCHERS:
            # Reuse a previously-created researcher (multi-affiliation)
            picked = random.choice(researcher_seed)
            members.append(picked)
        else:
            full, _ = name(researcher_idx)
            r_id = cod_rh(researcher_idx)
            researcher_seed.append((r_id, full))
            members.append((r_id, full))
            researcher_idx += 1

    # Lider = first member
    lider_id, lider_name = members[0]
    nro = nro_gruplac(gi)
    inst = random.choice(INSTITUTIONS)

    group = {
        "codigo_input": f"COL{nro[-7:]}",
        "nro_gruplac": nro,
        "url": f"https://scienti.minciencias.gov.co/gruplac/jsp/visualiza/visualizagr.jsp?nro={nro}",
        "nombre": f"Grupo de {theme.title()} — {inst.replace('UNIVERSIDAD ', '').replace('PONTIFICIA ', '')}",
        "fecha_formacion": f"{random.randint(1995, 2018)}-{random.randint(1, 12):02d}",
        "departamento_ciudad": random.choice(DEPARTMENTS),
        "lider": lider_name,
        "pagina_web": "",
        "email": f"grupo.{theme}@{inst.split()[-1].lower()}.edu.co",
        "clasificacion": random.choice(GROUP_CLASSIFICATIONS),
        "area_conocimiento": random.choice(THEMES[theme]["areas"]),
        "programa_nacional": "Ciencia, Tecnología e Innovación",
        "certificado": "Sí",
        "instituciones": [inst],
        "plan_estrategico": (
            f"Promover la investigación en {theme}, formar nuevos investigadores "
            f"a nivel doctoral y posdoctoral, difundir resultados en revistas "
            f"indexadas."
        ),
        "lineas_investigacion": THEMES[theme]["lines"][:],
        "integrantes": [
            {
                "nombre": m_name,
                "vinculacion": random.choice(
                    ["Investigador Principal", "Coinvestigador", "Estudiante de doctorado"]
                ),
                "horas_dedicacion": str(random.choice([5, 10, 20, 40])),
                "periodo": "2020-Actual",
                "cod_rh": m_id,
                "url_cvlac": f"https://scienti.minciencias.gov.co/cvlac/visualizador/generarCurriculoCv.do?cod_rh={m_id}",
            }
            for m_id, m_name in members
        ],
        "total_integrantes": len(members),
        "ids_cvlac": [m_id for m_id, _ in members],
        "_theme": theme,
        "formacion_extension": {},
        "produccion": {},
        "total_productos": 0,
        "scrape_date": date.today().isoformat(),
    }
    groups.append(group)


# Build researcher → groups index, then group → theme(s)
researcher_groups: dict[str, list[int]] = {}
for gi, g in enumerate(groups):
    for m_id in g["ids_cvlac"]:
        researcher_groups.setdefault(m_id, []).append(gi)

# Name lookup
name_of = dict(researcher_seed)

# ── Generate publications ────────────────────────────────

# Each researcher has 2–8 articles. Coauthors are drawn preferentially
# from the same group(s), with some cross-group leakage to make the
# coauthorship graph interesting.

def coauthors_for(cod: str, max_coauthors: int) -> list[str]:
    """Pick coauthors with a bias toward groupmates."""
    n = random.randint(0, max_coauthors)
    if n == 0 or cod not in researcher_groups:
        return []
    gids = researcher_groups[cod]
    candidate_pool: list[str] = []
    for gi in gids:
        for m in groups[gi]["ids_cvlac"]:
            if m != cod:
                candidate_pool.append(m)
    # Add some random outsiders (cross-group ties)
    others = [r for r, _ in researcher_seed if r != cod and r not in candidate_pool]
    candidate_pool = candidate_pool * 3 + random.sample(others, min(20, len(others)))
    return random.sample(list(set(candidate_pool)), min(n, len(set(candidate_pool))))


JOURNALS = [
    "Journal of Algebra",
    "Communications in Algebra",
    "Discrete Mathematics",
    "Linear Algebra and its Applications",
    "Revista Colombiana de Matemáticas",
    "Mathematics",
    "Advances in Mathematics",
    "European Journal of Combinatorics",
]


def article_string(idx: int, authors: list[str], topic: str, year: int) -> str:
    """Reproduce the messy raw format that the real scraper extracts."""
    authors_str = ", ".join(authors)
    journal = random.choice(JOURNALS)
    vol = random.randint(10, 80)
    pages = f"{random.randint(1, 500)} - {random.randint(501, 999)}"
    return (
        f"Producción bibliográfica - Artículo - Completo {authors_str}, "
        f"\"{topic}\" . En: Colombia {journal} ISSN: 0210-1859 ed: Editorial "
        f"v.{vol} p.{pages} ,{year}, Palabras: investigación, álgebra,"
    )


cvlacs: list[dict] = []
for cod, full_name in researcher_seed:
    gids = researcher_groups.get(cod, [])
    if not gids:
        primary_theme = random.choice(THEME_KEYS)
    else:
        # Primary theme = first group's theme.
        primary_theme = groups[gids[0]]["_theme"]
    theme_data = THEMES[primary_theme]

    sex = "Femenino" if full_name.split(",")[1].strip().split()[0] in FIRST_NAMES_F else "Masculino"

    n_articles = random.randint(2, 8)
    articles = []
    for ai in range(n_articles):
        co = coauthors_for(cod, max_coauthors=4)
        co_names = [full_name] + [name_of[c] for c in co]
        random.shuffle(co_names)
        topic = random.choice(theme_data["paper_topics"])
        year = random.randint(2010, 2024)
        articles.append(article_string(ai, co_names, topic, year))

    cv = {
        "cod_rh": cod,
        "url": f"https://scienti.minciencias.gov.co/cvlac/visualizador/generarCurriculoCv.do?cod_rh={cod}",
        "nombre": full_name,
        "nombre_citaciones": "",
        "nacionalidad": "Colombiana",
        "sexo": sex,
        "categoria_minciencias": random.choice(CATEGORIES),
        "par_evaluador_reconocido": random.random() < 0.2,
        "redes": {},
        "nivel_maximo": random.choice(["Doctorado", "Maestría", "Doctorado", "Pregrado"]),
        "formacion_academica": [
            {
                "raw": f"Doctorado {random.choice(INSTITUTIONS)} {primary_theme.title()}",
                "nivel": "Doctorado",
                "institucion": random.choice(INSTITUTIONS),
                "anio_inicio": str(random.randint(1995, 2018)),
                "anio_fin": str(random.randint(2000, 2024)),
            }
        ],
        "formacion_complementaria": [],
        "estancias_posdoctorales": [],
        "experiencia": [random.choice(INSTITUTIONS)],
        "areas_actuacion": theme_data["areas"],
        "idiomas": [
            {"idioma": "Español", "habla": "Bien", "escribe": "Bien", "lee": "Bien", "entiende": "Bien"},
            {"idioma": "Inglés", "habla": "Bien", "escribe": "Bien", "lee": "Bien", "entiende": "Bien"},
        ],
        "lineas_investigacion": theme_data["lines"],
        "reconocimientos": [],
        "asesorias": [],
        "cursos_corta_duracion_dictados": [],
        "trabajos_dirigidos": [],
        "jurado_comites_evaluacion": [],
        "participacion_comites": [],
        "par_evaluador_detalle": [],
        "ediciones_revisiones": [],
        "eventos_cientificos": [],
        "produccion": {
            "articulos": {"total": len(articles), "items": articles},
            "libros": {"total": 0, "items": []},
            "capitulos_libro": {"total": 0, "items": []},
            "notas_cientificas": {"total": 0, "items": []},
            "otra_prod_biblio": {"total": 0, "items": []},
            "software": {"total": 0, "items": []},
            "patentes": {"total": 0, "items": []},
            "innovacion_proceso": {"total": 0, "items": []},
            "demas_trabajos": {"total": 0, "items": []},
            "textos_no_cientificos": {"total": 0, "items": []},
            "otra_prod_bibliografica": {"total": 0, "items": []},
            "informes_tecnicos": {"total": 0, "items": []},
            "informes_investigacion": {"total": 0, "items": []},
            "consultorias": {"total": 0, "items": []},
        },
        "total_productos": len(articles),
        "proyectos": [],
        "scrape_date": date.today().isoformat(),
    }
    cvlacs.append(cv)

# ── Write to disk ───────────────────────────────────────

CVLAC_DIR.mkdir(parents=True, exist_ok=True)
GRUPLAC_DIR.mkdir(parents=True, exist_ok=True)

for cv in cvlacs:
    with open(CVLAC_DIR / f"{cv['cod_rh']}.json", "w", encoding="utf-8") as f:
        json.dump(cv, f, ensure_ascii=False, indent=2)

for g in groups:
    # Strip the internal `_theme` helper from the persisted JSON.
    g_clean = {k: v for k, v in g.items() if not k.startswith("_")}
    with open(GRUPLAC_DIR / f"{g['nro_gruplac']}.json", "w", encoding="utf-8") as f:
        json.dump(g_clean, f, ensure_ascii=False, indent=2)

print(f"Wrote {len(cvlacs)} CvLAC and {len(groups)} GrupLAC.")
print(f"  CvLAC → {CVLAC_DIR}")
print(f"  GrupLAC → {GRUPLAC_DIR}")
