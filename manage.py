#!/usr/bin/env python
import os
import sys

cwd = os.path.abspath(__file__)
sys.path.append("/tmp/pycharm_project_270/askcos-core")


if __name__ == "__main__":
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "askcos_site.settings")

    from django.core.management import execute_from_command_line

    execute_from_command_line(sys.argv)
