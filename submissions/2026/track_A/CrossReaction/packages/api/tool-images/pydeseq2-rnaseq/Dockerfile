FROM quay.io/biocontainers/pydeseq2:0.5.4--pyhdfd78af_0

USER root
RUN mkdir -p /tool
COPY run.py /tool/run.py
RUN chmod +x /tool/run.py

ENTRYPOINT ["/tool/run.py"]
