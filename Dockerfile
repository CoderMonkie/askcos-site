ARG KETCHER_VERSION=2.1
ARG CORE_VERSION=dev
ARG BASE_VERSION=2020.03.6-gh2855-py37-conda

FROM askcos/askcos-ketcher:$KETCHER_VERSION as ketcher
FROM askcos/askcos-core:$CORE_VERSION as core
FROM askcos/askcos-base:$BASE_VERSION as base

COPY --chown=askcos:askcos --from=core /usr/local/askcos-core /usr/local/askcos-core
COPY --chown=askcos:askcos . /usr/local/askcos-site
COPY --chown=askcos:askcos --from=ketcher /build/dist/ /usr/local/askcos-site/askcos_site/static/ketcher/dist/

ENV PYTHONPATH=/usr/local/askcos-site:/usr/local/askcos-core${PYTHONPATH:+:${PYTHONPATH}}

RUN python /usr/local/askcos-site/manage.py collectstatic --noinput

LABEL site.version={VERSION} \
      site.git.hash={GIT_HASH} \
      site.git.date={GIT_DATE} \
      site.git.describe={GIT_DESCRIBE}
