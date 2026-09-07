'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Card, CardContent, CardFooter, CardHeader, CardTitle,
} from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import {
  counsellingCourseImageUrl, counsellingExamUrl, loadCounsellingCourses, mbtiPaperUrl,
} from '../../_lib/api';
import type { CounsellingAttempt, CounsellingCourse } from '../../_lib/types';

function AttemptHistory({ course, attempts }: { course: CounsellingCourse; attempts: CounsellingAttempt[] }) {
  const isMbti = course.title === 'MBTI';
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Attempt date</th>
            {isMbti ? (
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Result</th>
            ) : (
              <>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Marks</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Right</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Wrong</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {attempts.map((attempt) => (
            <tr key={attempt.id} className="border-t">
              <td className="px-3 py-2">{attempt.exam_date}</td>
              {isMbti ? (
                <td className="px-3 py-2 font-semibold text-warning">{attempt.obtain_marks}</td>
              ) : (
                <>
                  <td className="px-3 py-2">
                    <span className="font-semibold text-warning">{attempt.obtain_marks}</span>
                    {' / '}
                    <span className="font-semibold text-primary">{attempt.total_points ?? 0}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-semibold text-success">{attempt.total_right ?? 0}</span>
                    {' / '}
                    <span className="font-semibold text-primary">{attempt.total_ques ?? 0}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-semibold text-destructive">{attempt.total_wrong ?? 0}</span>
                    {' / '}
                    <span className="font-semibold text-primary">{attempt.total_ques ?? 0}</span>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CourseCard({ course, attempts }: { course: CounsellingCourse; attempts: CounsellingAttempt[] }) {
  const isMbti = course.title === 'MBTI';
  const canTakeTest = isMbti || course.total_ques > 0;
  const testHref = isMbti ? mbtiPaperUrl(course.id) : counsellingExamUrl(course.id);

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-center gap-3 border-b">
        {course.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={counsellingCourseImageUrl(course.image)}
            alt=""
            className="size-10 rounded object-cover"
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
          />
        ) : null}
        <CardTitle>{course.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-3 text-sm text-muted-foreground">
        {/* Course descriptions are admin-authored rich text from the ERP,
            rendered as HTML the same way show_lmsCounselling.blade.php does
            with {!! $val['description'] !!} — trusted staff-entered content,
            not user input. */}
        <div dangerouslySetInnerHTML={{ __html: course.description }} />
        {attempts.length > 0 ? <AttemptHistory course={course} attempts={attempts} /> : null}
      </CardContent>
      <CardFooter className="justify-center bg-transparent px-(--card-spacing) pb-(--card-spacing)">
        {canTakeTest ? (
          <a
            href={testHref}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: 'default' }), 'bg-blue-600 text-white hover:bg-blue-700')}
          >
            {isMbti ? 'Take MBTI test' : 'Take the test'}
          </a>
        ) : null}
      </CardFooter>
    </Card>
  );
}

export function CounsellingCourses() {
  const [courses, setCourses] = useState<CounsellingCourse[]>([]);
  const [attemptsByCourse, setAttemptsByCourse] = useState<Record<string, CounsellingAttempt[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await loadCounsellingCourses();
      setCourses(data.courses);
      setAttemptsByCourse(data.attemptsByCourse);
    } catch {
      setError('Could not load counselling courses. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-muted/30 p-6 text-center">
        <h2 className="text-xl font-semibold">Take a free personality test!</h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
          Today, the art of talking therapies such as counselling are used to help people come to
          terms with many problems they are facing, with an ultimate aim of overcoming them.
        </p>
      </div>

      <h2 className="text-lg font-semibold">Suggested short courses in counselling</h2>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Spinner className="size-4" />
          Loading courses…
        </div>
      ) : error ? (
        <p className="py-10 text-center text-sm text-destructive">{error}</p>
      ) : courses.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No counselling courses are available yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              attempts={attemptsByCourse[String(course.id)] ?? []}
            />
          ))}
        </div>
      )}
    </div>
  );
}
