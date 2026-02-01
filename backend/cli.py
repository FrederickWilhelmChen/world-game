import argparse
import sys

from .crawler.eia_oil import crawl_oil
from .crawler.fao_agriculture import crawl_agriculture
from .crawler.usgs_minerals import crawl_minerals
from .crawler.worldbank_gdp import crawl_gdp
from .utils.data_merger import merge_all_data


def main(argv=None):
    parser = argparse.ArgumentParser(prog="world-game")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("crawl-gdp")
    sub.add_parser("crawl-oil")
    sub.add_parser("crawl-agriculture")
    sub.add_parser("crawl-minerals")
    sub.add_parser("crawl-all")
    sub.add_parser("merge")

    args = parser.parse_args(argv)

    if args.cmd == "crawl-gdp":
        crawl_gdp()
        return 0
    if args.cmd == "crawl-oil":
        crawl_oil()
        return 0
    if args.cmd == "crawl-agriculture":
        crawl_agriculture()
        return 0
    if args.cmd == "crawl-minerals":
        crawl_minerals()
        return 0
    if args.cmd == "crawl-all":
        crawl_gdp()
        crawl_oil()
        crawl_agriculture()
        crawl_minerals()
        merge_all_data()
        return 0
    if args.cmd == "merge":
        merge_all_data()
        return 0

    return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
