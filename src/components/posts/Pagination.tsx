import { Button } from '@/components/ui';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  baseUrl?: string;
}

export function Pagination({ currentPage, totalPages, baseUrl = '?page=' }: PaginationProps) {
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  return (
    <nav className="flex items-center justify-center gap-2">
      {currentPage > 1 && (
        <a href={`${baseUrl}${currentPage - 1}`}>
          <Button variant="outline" size="sm">
            Previous
          </Button>
        </a>
      )}

      <div className="flex items-center gap-1">
        {getPageNumbers().map((page, index) =>
          typeof page === 'number' ? (
            <a key={index} href={`${baseUrl}${page}`}>
              <Button
                variant={page === currentPage ? 'primary' : 'ghost'}
                size="sm"
                className="min-w-[40px]"
              >
                {page}
              </Button>
            </a>
          ) : (
            <span key={index} className="px-2 text-gray-500">
              {page}
            </span>
          )
        )}
      </div>

      {currentPage < totalPages && (
        <a href={`${baseUrl}${currentPage + 1}`}>
          <Button variant="outline" size="sm">
            Next
          </Button>
        </a>
      )}
    </nav>
  );
}
