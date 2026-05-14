# Wheels staging directory

The Dockerfile picks up any `aiq_quivers-*.whl` here at build time. This is
a temporary bridge until `aiq-quivers 1.2.0` is published on PyPI — once
the upload is done you can delete the wheel and rebuild; the Dockerfile
will fall through to `pip install aiq-quivers>=1.2.0` automatically.

To refresh the staged wheel:

```bash
cd ../../../quivers_analysis
python -m build
cp dist/aiq_quivers-*.whl ../scholar_agent_app/backend/wheels/
```
