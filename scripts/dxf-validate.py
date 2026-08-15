#!/usr/bin/env python3
"""
Validatore DXF SEVERO per la suite Open E.Hub — apre un file DXF con `ezdxf` (parser rigido,
tipo-AutoCAD) ed esegue l'audit. Esce con codice ≠0 se il file è illeggibile o l'audit
trova ERRORI bloccanti (i «fixes» sono warning auto-risolti e NON fanno fallire).

Serve a garantire che gli export DXF (fronte/unifilare/flow/documento) siano accettati dai
CAD rigidi su Windows (AutoCAD/GstarCAD/Eplus) e non solo dai viewer permissivi.

Uso:  python3 scripts/dxf-validate.py <file.dxf> [<file2.dxf> ...]
Richiede: pip install "ezdxf>=1.1"  (vedi requirements-dev.txt)
"""
import sys

try:
    import ezdxf
except ImportError:
    sys.stderr.write("ezdxf non installato: pip install -r requirements-dev.txt\n")
    sys.exit(2)


def validate(path: str) -> int:
    try:
        doc = ezdxf.readfile(path)
    except Exception as e:  # noqa: BLE001 — vogliamo qualunque fallimento di lettura
        print(f"FAIL  {path}: readfile → {type(e).__name__}: {e}")
        return 1
    auditor = doc.audit()
    n_err = len(auditor.errors)
    n_fix = len(auditor.fixes)
    if n_err:
        print(f"FAIL  {path}: {n_err} errori di audit ({n_fix} fix)")
        for e in auditor.errors[:30]:
            print(f"   ERR {e.code} {e.message}")
        return 1
    print(f"OK    {path}: audit pulito ({n_fix} fix non bloccanti, {len(list(doc.modelspace()))} entità)")
    return 0


def main() -> int:
    if len(sys.argv) < 2:
        sys.stderr.write("uso: dxf-validate.py <file.dxf> [...]\n")
        return 2
    rc = 0
    for p in sys.argv[1:]:
        rc |= validate(p)
    return rc


if __name__ == "__main__":
    sys.exit(main())
