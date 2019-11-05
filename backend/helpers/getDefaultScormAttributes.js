module.exports = function(user) {

    var userId = user._id;

    return {
        cmi: {
            core: {
                _children: "student_id,student_name,lesson_location,credit,lesson_status,entry,score,exit",
                student_id: userId,
                student_name: `${user.lastName},${user.firstName}`,
                lesson_location: "",
                credit: "credit",
                lesson_status: "not attempted",
                entry: "ab initio",
                exit: "",
                total_time: "0000:00:00.00",
                session_time: "0000:00:00.00",
                score: {
                    _children: "raw",
                    raw: ""
                }
            },
            suspend_data: "{}",
            launch_data: ""
        }
    }
}